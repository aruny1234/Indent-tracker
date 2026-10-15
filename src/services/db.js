import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection, doc, onSnapshot, query, where, orderBy, limit, writeBatch,
  serverTimestamp, Timestamp, addDoc, updateDoc, setDoc, arrayUnion,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase.js';
import { computeStatus, STATUS } from '../utils/status.js';
import { fmtDate, toDate } from '../utils/dates.js';

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const asTimestamp = (v) => (v instanceof Date ? Timestamp.fromDate(v) : v);

// ---------- Live listeners ----------
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export function watchIndents(uid, isManager, cb, onError) {
  const q = isManager
    ? collection(db, 'indents')
    : query(collection(db, 'indents'), where('assignedUserId', '==', uid)); // employees can only query their own
  return onSnapshot(q, (s) => cb(rows(s)), onError);
}
export function watchUsers(cb, onError) {
  return onSnapshot(collection(db, 'users'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), onError);
}
export function watchNotifications(uid, cb, onError) {
  return onSnapshot(query(collection(db, 'notifications'), where('userId', '==', uid)), (s) => cb(rows(s)), onError);
}
export function watchImportHistory(cb, onError) {
  return onSnapshot(query(collection(db, 'importHistory'), orderBy('importedAt', 'desc'), limit(50)), (s) => cb(rows(s)), onError);
}
export function watchAudit(cb, onError) {
  return onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(300)), (s) => cb(rows(s)), onError);
}

// ---------- Audit ----------
const auditValue = (v) => {
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

// ---------- Import ----------
export async function saveImport(classified, fileName, actor) {
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
        batch.set(ref, {
          ...netsuite,
          assignedUserId: null, assignedUserName: null, assignedAt: null,
          expectedReceivingDate: null, actualReceivingDate: null, completedAt: null,
          trackingStatus: STATUS.NOT_SCHEDULED, remarks: '',
        });
      } else {
        batch.update(ref, netsuite); // only NetSuite fields; assignment and dates are kept
      }
    }
    await batch.commit();
  }
  const count = (c) => classified.filter((r) => r.category === c).length;
  const summary = {
    totalRows: classified.length, newRows: count('new'), updatedRows: count('update'),
    duplicateRows: count('duplicate'), invalidRows: count('invalid'),
  };
  await addDoc(collection(db, 'importHistory'), {
    fileName, importedBy: actor.name, importedById: actor.uid, importedAt: serverTimestamp(), ...summary,
  });
  return summary;
}

// ---------- Indent updates ----------
/** `changes` may contain Date objects; they are stored as Firestore Timestamps. */
export async function updateIndent(indent, changes, actor) {
  const data = {};
  for (const [k, v] of Object.entries(changes)) data[k] = asTimestamp(v);
  if ('assignedAt' in changes) data.assignedAt = changes.assignedAt ? serverTimestamp() : null;
  if ('actualReceivingDate' in changes) data.completedAt = changes.actualReceivingDate ? serverTimestamp() : null;
  const status = computeStatus({ ...indent, ...changes });
  if (status !== indent.trackingStatus) data.trackingStatus = status;
  data.updatedAt = serverTimestamp();
  data.updatedBy = actor.uid;

  let action = 'Updated';
  if ('assignedUserId' in changes) action = changes.assignedUserId ? 'Assigned' : 'Unassigned';
  else if ('actualReceivingDate' in changes) action = changes.actualReceivingDate ? 'Marked received' : 'Reopened';
  else if ('expectedReceivingDate' in changes) action = 'Expected date changed';

  const auditChanges = { ...changes };
  delete auditChanges.assignedAt;
  delete auditChanges.assignedUserId;

  const batch = writeBatch(db);
  batch.update(doc(db, 'indents', indent.id), data);
  batch.set(doc(collection(db, 'auditLogs')), auditEntry(actor, action, indent, indent, auditChanges));
  await batch.commit();
}

export async function assignIndents(indents, user, expectedDate, remarks, actor) {
  for (const part of chunk(indents, 200)) {
    const batch = writeBatch(db);
    for (const ind of part) {
      const changes = { assignedUserName: user.name };
      if (expectedDate) changes.expectedReceivingDate = expectedDate;
      if (remarks) changes.remarks = remarks;
      const merged = { ...ind, ...changes };
      batch.update(doc(db, 'indents', ind.id), {
        ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, asTimestamp(v)])),
        assignedUserId: user.uid,
        assignedAt: serverTimestamp(),
        trackingStatus: computeStatus(merged),
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      });
      batch.set(doc(collection(db, 'auditLogs')), auditEntry(actor, ind.assignedUserId ? 'Reassigned' : 'Assigned', ind, ind, changes));
    }
    await batch.commit();
  }
}

// ---------- Users ----------
/**
 * Creating a login from the browser normally signs the manager out.
 * A temporary second Firebase app avoids that.
 */
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
    const batch = writeBatch(db);
    part.forEach((id) => batch.update(doc(db, 'notifications', id), { read: true }));
    await batch.commit();
  }
}
export function createNotification(id, data) {
  return setDoc(doc(db, 'notifications', id), { ...data, read: false, createdAt: serverTimestamp(), notificationDate: Timestamp.now() });
}

export { toDate };
