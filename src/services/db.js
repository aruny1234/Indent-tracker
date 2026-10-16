import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection, doc, onSnapshot, query, where, orderBy, limit, writeBatch,
  serverTimestamp, Timestamp, updateDoc, setDoc, arrayUnion,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase.js';
import { enrich, storedStatus, COMPUTED_KEYS } from '../utils/status.js';
import { indentKey } from '../utils/excel.js';
import { fmtDate } from '../utils/dates.js';

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const asTimestamp = (v) => (v instanceof Date ? Timestamp.fromDate(v) : v);
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// ---------- Live listeners ----------
export function watchIndents(uid, isManager, cb, onError) {
  const q = isManager ? collection(db, 'indents') : query(collection(db, 'indents'), where('assignedUserId', '==', uid));
  return onSnapshot(q, (s) => cb(rows(s)), onError);
}
export function watchUsers(cb, onError) {
  return onSnapshot(collection(db, 'users'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), onError);
}
export function watchNotifications(uid, cb, onError) {
  return onSnapshot(query(collection(db, 'notifications'), where('userId', '==', uid)), (s) => cb(rows(s)), onError);
}
export function watchImportHistory(cb, onError) {
  return onSnapshot(query(collection(db, 'importHistory'), orderBy('importedAt', 'desc'), limit(100)), (s) => cb(rows(s)), onError);
}
export function watchAudit(cb, onError) {
  return onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(300)), (s) => cb(rows(s)), onError);
}

// ---------- Audit ----------
const auditValue = (v) => {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  if (v == null || v === '') return '—';
  if (v instanceof Date || typeof v?.toDate === 'function') return fmtDate(v);
  return String(v);
};
function auditEntry(actor, action, indent, before, after) {
  const oldValue = {};
  const newValue = {};
  for (const k of Object.keys(after)) {
    oldValue[k] = auditValue(before[k]);
    newValue[k] = auditValue(after[k]);
  }
  return {
    userId: actor.uid, userName: actor.name, action,
    indentId: indent.id, documentNumber: indent.documentNumber || '', itemCode: indent.itemCode || '',
    oldValue, newValue, timestamp: serverTimestamp(),
  };
}

// ---------- Import (with batch id) ----------
export function nextBatchId(history, now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const prefix = `IMP-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-`;
  const used = history.filter((h) => (h.batchId || '').startsWith(prefix)).map((h) => Number(h.batchId.slice(prefix.length)) || 0);
  return prefix + String(Math.max(0, ...used) + 1).padStart(3, '0');
}

export async function saveImport(classified, fileName, actor, batchId) {
  const toWrite = classified.filter((r) => r.category === 'new' || r.category === 'update');
  const now = serverTimestamp();
  for (const part of chunk(toWrite, 450)) {
    const batch = writeBatch(db);
    for (const r of part) {
      const ref = doc(db, 'indents', r.key);
      const netsuite = {
        documentNumber: r.documentNumber, itemCode: r.itemCode, date: Timestamp.fromDate(r.date),
        orderType: r.orderType, netsuiteStatus: r.netsuiteStatus, displayName: r.displayName,
        quantity: r.quantity, units: r.units, lastPurchasePrice: r.lastPurchasePrice, createdBy: r.createdBy,
        importedAt: now, updatedAt: now, lastImportFile: fileName,
      };
      if (r.category === 'new') {
        const fresh = {
          ...netsuite, importBatchId: batchId,
          assignedUserId: null, assignedUserName: null, assignedAt: null,
          poRequired: true, expectedPoDate: null, poCreationDate: null, poNumber: '', poRemarks: '',
          expectedReceivingDate: null, actualReceivingDate: null, receivingRemarks: '', remarks: '', completedAt: null,
        };
        batch.set(ref, { ...fresh, ...storedStatus(enrich(fresh)) });
      } else {
        batch.update(ref, { ...netsuite, lastImportBatchId: batchId }); // NetSuite fields only
      }
    }
    await batch.commit();
  }
  const count = (c) => classified.filter((r) => r.category === c).length;
  const summary = {
    totalRows: classified.length, newRows: count('new'), updatedRows: count('update'),
    duplicateRows: count('duplicate'), invalidRows: count('invalid'),
  };
  await setDoc(doc(db, 'importHistory', batchId), {
    batchId, fileName, importedBy: actor.name, importedById: actor.uid, importedAt: serverTimestamp(), deleted: false, ...summary,
  });
  return summary;
}

/** Deletes every indent line created by this import batch, then records the deletion. */
export async function deleteImportBatch(history, indentsInBatch, actor) {
  for (const part of chunk(indentsInBatch, 450)) {
    const batch = writeBatch(db);
    part.forEach((i) => batch.delete(doc(db, 'indents', i.id)));
    await batch.commit();
  }
  const b = writeBatch(db);
  b.update(doc(db, 'importHistory', history.id), {
    deleted: true, deletedAt: serverTimestamp(), deletedBy: actor.name, deletedById: actor.uid, deletedRecords: indentsInBatch.length,
  });
  b.set(doc(collection(db, 'auditLogs')), {
    userId: actor.uid, userName: actor.name, action: 'DELETE_IMPORT_BATCH',
    indentId: null, documentNumber: '', itemCode: '', batchId: history.batchId,
    oldValue: {}, newValue: { batchId: history.batchId, fileName: history.fileName, records: String(indentsInBatch.length) },
    timestamp: serverTimestamp(),
  });
  await b.commit();
}

export async function deleteIndent(indent, actor) {
  const snapshot = {};
  ['documentNumber', 'itemCode', 'displayName', 'quantity', 'assignedUserName', 'poNumber', 'overallStatus', 'importBatchId']
    .forEach((k) => (snapshot[k] = indent[k]));
  const entry = auditEntry(actor, 'DELETE_INDENT', indent, snapshot, snapshot);
  entry.newValue = Object.fromEntries(Object.keys(entry.oldValue).map((k) => [k, 'deleted']));
  const b = writeBatch(db);
  b.delete(doc(db, 'indents', indent.id));
  b.set(doc(collection(db, 'auditLogs')), entry);
  await b.commit();
}

// ---------- Edit ----------
function actionFor(indent, changes) {
  if (changes.actualReceivingDate && !indent.actualReceivingDate) return 'MATERIAL_RECEIVED';
  if (changes.poCreationDate && !indent.poCreationDate) return 'PO_CREATED';
  if ('assignedUserId' in changes) return changes.assignedUserId ? (indent.assignedUserId ? 'REASSIGN' : 'ASSIGN') : 'UNASSIGN';
  return 'EDIT_INDENT';
}

/**
 * Saves changed fields and recalculates statuses.
 * If Document Number or Item Code changes, the record moves to its new key (Document Number + Item)
 * so a later re-import of the corrected line updates it instead of creating a duplicate.
 */
export async function updateIndent(indent, changes, actor) {
  const merged = { ...indent, ...changes };
  const data = {};
  for (const [k, v] of Object.entries(changes)) data[k] = asTimestamp(v);
  if ('assignedAt' in changes) data.assignedAt = changes.assignedAt ? serverTimestamp() : null;
  if ('actualReceivingDate' in changes) data.completedAt = changes.actualReceivingDate ? serverTimestamp() : null;
  Object.assign(data, storedStatus(enrich(merged)), { updatedAt: serverTimestamp(), updatedBy: actor.uid });

  const auditChanges = { ...changes };
  delete auditChanges.assignedAt;
  delete auditChanges.assignedUserId;

  const newId = indentKey(merged.documentNumber, merged.itemCode);
  const moved = newId !== indent.id;
  const b = writeBatch(db);
  if (moved) {
    const raw = { ...indent };
    COMPUTED_KEYS.forEach((k) => delete raw[k]);
    b.set(doc(db, 'indents', newId), { ...raw, ...data });
    b.delete(doc(db, 'indents', indent.id));
  } else {
    b.update(doc(db, 'indents', indent.id), data);
  }
  b.set(doc(collection(db, 'auditLogs')), auditEntry(actor, actionFor(indent, changes), { ...merged, id: newId }, indent, auditChanges));
  await b.commit();
  return newId;
}

/** opts: { poRequired: true|false|undefined, expectedPoDate, expectedReceivingDate, remarks } */
export async function assignIndents(indents, user, opts, actor) {
  for (const part of chunk(indents, 200)) {
    const b = writeBatch(db);
    for (const ind of part) {
      const changes = { assignedUserName: user.name };
      if (opts.poRequired !== undefined) changes.poRequired = opts.poRequired;
      if (opts.expectedPoDate) changes.expectedPoDate = opts.expectedPoDate;
      if (opts.expectedReceivingDate) changes.expectedReceivingDate = opts.expectedReceivingDate;
      if (opts.remarks) changes.remarks = opts.remarks;
      const merged = { ...ind, ...changes, assignedUserId: user.uid };
      b.update(doc(db, 'indents', ind.id), {
        ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, asTimestamp(v)])),
        assignedUserId: user.uid,
        assignedAt: serverTimestamp(),
        ...storedStatus(enrich(merged)),
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      });
      b.set(doc(collection(db, 'auditLogs')), auditEntry(actor, ind.assignedUserId ? 'REASSIGN' : 'ASSIGN', ind, ind, changes));
    }
    await b.commit();
  }
}

// ---------- Users ----------
export async function createEmployee(data, actor) {
  const secondary = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
  try {
    const secAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secAuth, data.email.trim(), data.password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid, name: data.name.trim(), email: data.email.trim().toLowerCase(),
      employeeId: data.employeeId.trim(), role: data.role, department: data.department.trim(),
      active: true, createdAt: serverTimestamp(), createdBy: actor.uid,
    });
    await signOut(secAuth);
  } finally {
    await deleteApp(secondary);
  }
}
export function updateEmployee(uid, data) {
  return updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
}
export function saveFcmToken(uid, token) {
  return updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
}

// ---------- Notifications ----------
export function markRead(id) {
  return updateDoc(doc(db, 'notifications', id), { read: true });
}
export async function markAllRead(ids) {
  for (const part of chunk(ids, 450)) {
    const b = writeBatch(db);
    part.forEach((id) => b.update(doc(db, 'notifications', id), { read: true }));
    await b.commit();
  }
}
export function createNotification(id, data) {
  return setDoc(doc(db, 'notifications', id), { ...data, read: false, createdAt: serverTimestamp(), notificationDate: Timestamp.now() });
}
