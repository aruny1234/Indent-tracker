export const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function safeDate(y, mo, d) {
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? dt : null;
}
const fullYear = (y) => (y < 100 ? 2000 + y : y);

/** Excel serial day number -> local Date (midnight). */
export function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || !isFinite(serial) || serial < 1) return null;
  const utc = new Date(Math.round((serial - 25569) * DAY_MS));
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Parses DD-MM-YYYY, DD/MM/YYYY, DD.MM.YY, YYYY-MM-DD and 14-Oct-2026. Day comes first (Indian format). */
export function parseDateString(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return safeDate(fullYear(+m[3]), +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return safeDate(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2,4})$/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return safeDate(fullYear(+m[3]), MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

/** Accepts Date, Firestore Timestamp, Excel serial or date string. */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  if (typeof v === 'number') return excelSerialToDate(v);
  if (typeof v === 'string') return parseDateString(v);
  return null;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** Whole calendar days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}
export function fmtDate(v, empty = '—') {
  const d = toDate(v);
  return d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : empty;
}
export function fmtDateTime(v) {
  const d = toDate(v);
  return d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}
/** Date -> 'YYYY-MM-DD' for <input type="date"> */
export function toInputValue(v) {
  const d = toDate(v);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}
export function fromInputValue(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** 'YYYYMMDD' — used in notification ids (must match functions/index.js). */
export function dateKey(v) {
  const d = toDate(v);
  return d ? `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` : 'none';
}
