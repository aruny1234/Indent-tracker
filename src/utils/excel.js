import * as XLSX from 'xlsx';
import { excelSerialToDate, parseDateString, toDate, startOfDay, fmtDate } from './dates.js';

// Header names are compared after lower-casing and removing spaces/punctuation.
const FIELD_ALIASES = {
  date: ['date', 'prdate', 'documentdate', 'trandate', 'indentdate'],
  documentNumber: ['documentnumber', 'documentno', 'docnumber', 'docno', 'prnumber', 'prno', 'indentno', 'indentnumber'],
  orderType: ['ordertype'],
  netsuiteStatus: ['status', 'prstatus', 'documentstatus'],
  itemCode: ['item', 'itemcode', 'itemno', 'itemnumber'],
  displayName: ['displayname', 'description', 'itemdescription', 'itemname'],
  quantity: ['prquantity', 'quantity', 'qty'],
  units: ['units', 'unit', 'uom'],
  lastPurchasePrice: ['lastpurchaseprice', 'lpp', 'lastprice'],
  createdBy: ['createdby', 'requestor', 'requestedby'],
};

export const FIELD_LABELS = {
  date: 'Date', documentNumber: 'Document Number', orderType: 'Order Type', netsuiteStatus: 'Status',
  itemCode: 'Item', displayName: 'Display Name', quantity: 'PR Quantity', units: 'Units',
  lastPurchasePrice: 'Last Purchase Price', createdBy: 'Created By',
};

/** Fields that come from NetSuite and are refreshed on re-import. */
export const NETSUITE_FIELDS = ['date', 'orderType', 'netsuiteStatus', 'displayName', 'quantity', 'units', 'lastPurchasePrice', 'createdBy'];

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (v) => String(v ?? '').trim();

/** Firestore document id for an indent line: Document Number + Item. Same key = same record. */
export function indentKey(documentNumber, itemCode) {
  return `${encodeURIComponent(text(documentNumber))}~${encodeURIComponent(text(itemCode))}`.replace(/\./g, '%2E');
}

function mapHeaders(row) {
  const map = {};
  row.forEach((cell, idx) => {
    const n = norm(cell);
    if (!n) return;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (map[field] === undefined && aliases.includes(n)) {
        map[field] = idx;
        break;
      }
    }
  });
  return map;
}

function toNumber(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[,₹\s]/g, ''));
  return isNaN(n) ? NaN : n;
}

function buildRecord(row, map, rowNumber) {
  const get = (f) => (map[f] === undefined ? '' : row[map[f]]);
  const errors = [];
  const documentNumber = text(get('documentNumber'));
  const itemCode = text(get('itemCode'));
  const dateRaw = get('date');
  const date = typeof dateRaw === 'number' ? excelSerialToDate(dateRaw) : dateRaw instanceof Date ? dateRaw : parseDateString(dateRaw);
  const quantity = toNumber(get('quantity'));
  const lastPurchasePrice = toNumber(get('lastPurchasePrice'));

  if (!documentNumber) errors.push('Document Number is empty');
  if (!itemCode) errors.push('Item is empty');
  if (!date) errors.push(text(dateRaw) ? `Date "${text(dateRaw)}" is not a valid DD-MM-YYYY date` : 'Date is empty');
  if (Number.isNaN(quantity)) errors.push('PR Quantity is not a number');
  if (Number.isNaN(lastPurchasePrice)) errors.push('Last Purchase Price is not a number');

  return {
    rowNumber,
    key: documentNumber && itemCode ? indentKey(documentNumber, itemCode) : null,
    documentNumber,
    itemCode,
    date,
    orderType: text(get('orderType')),
    netsuiteStatus: text(get('netsuiteStatus')),
    displayName: text(get('displayName')),
    quantity: Number.isNaN(quantity) ? null : quantity,
    units: text(get('units')),
    lastPurchasePrice: Number.isNaN(lastPurchasePrice) ? null : lastPurchasePrice,
    createdBy: text(get('createdBy')),
    errors,
  };
}

/** Reads .xls / .xlsx / .csv. Finds the header row automatically (NetSuite exports often have title rows on top). */
export async function parseIndentFile(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });

  let headerIdx = -1;
  let map = null;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const m = mapHeaders(rows[i]);
    if (m.documentNumber !== undefined && m.itemCode !== undefined) {
      headerIdx = i;
      map = m;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error('No header row with "Document Number" and "Item" columns was found in the first 25 rows. Check that this is the NetSuite Purchase Requisition export.');
  }

  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => text(c) === '')) continue;
    records.push(buildRecord(r, map, i + 1));
  }
  const detected = Object.keys(FIELD_LABELS).map((f) => ({
    field: f,
    label: FIELD_LABELS[f],
    header: map[f] === undefined ? null : text(rows[headerIdx][map[f]]),
  }));
  return { records, detected, sheetName, headerRow: headerIdx + 1 };
}

function sameValue(a, b) {
  if (a instanceof Date) {
    const d = toDate(b);
    return !!d && startOfDay(a).getTime() === startOfDay(d).getTime();
  }
  return String(a ?? '') === String(b ?? '');
}

/**
 * Sorts parsed rows into: new | update | duplicate | invalid.
 * duplicate = repeated inside the same file, or already in the database with nothing changed.
 */
export function classifyRecords(records, existingById) {
  const seen = new Set();
  return records.map((r) => {
    if (r.errors.length) return { ...r, category: 'invalid', note: r.errors.join('; ') };
    if (seen.has(r.key)) return { ...r, category: 'duplicate', note: 'Repeated in this file' };
    seen.add(r.key);
    const ex = existingById.get(r.key);
    if (!ex) return { ...r, category: 'new', note: '' };
    const changed = NETSUITE_FIELDS.filter((f) => !sameValue(r[f], ex[f]));
    if (!changed.length) return { ...r, category: 'duplicate', note: 'Already imported, no changes' };
    const show = (f, v) => (f === 'date' ? fmtDate(v) : v === '' || v == null ? '—' : v);
    const note = changed.map((f) => `${FIELD_LABELS[f]}: ${show(f, ex[f])} → ${show(f, r[f])}`).join('; ');
    return { ...r, category: 'update', changed, note };
  });
}
