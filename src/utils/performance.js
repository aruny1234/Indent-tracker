import { STATUS, delayDays } from './status.js';
import { toDate } from './dates.js';

/**
 * OTD % (On-Time Delivery) = on-time receipts / (on-time + late receipts + currently overdue).
 * Overdue items count as misses even before they arrive, so the figure cannot look better by leaving items open.
 */
export function summarize(list) {
  const s = { total: list.length, open: 0, completed: 0, onTime: 0, late: 0, overdue: 0, urgent: 0, dueSoon: 0, pending: 0, notScheduled: 0, delaySum: 0 };
  for (const i of list) {
    switch (i.status) {
      case STATUS.DONE_ON_TIME: s.completed++; s.onTime++; break;
      case STATUS.DONE_LATE: s.completed++; s.late++; s.delaySum += delayDays(i) || 0; break;
      case STATUS.COMPLETED: s.completed++; break;
      case STATUS.OVERDUE: s.open++; s.overdue++; break;
      case STATUS.URGENT: s.open++; s.urgent++; break;
      case STATUS.DUE_SOON: s.open++; s.dueSoon++; break;
      case STATUS.PENDING: s.open++; s.pending++; break;
      default: s.open++; s.notScheduled++;
    }
  }
  const base = s.onTime + s.late + s.overdue;
  s.otd = base ? Math.round((100 * s.onTime) / base) : null;
  s.avgDelay = s.late ? +(s.delaySum / s.late).toFixed(1) : 0;
  return s;
}

export function byEmployee(indents, users) {
  const groups = new Map();
  for (const i of indents) {
    if (!i.assignedUserId) continue;
    if (!groups.has(i.assignedUserId)) groups.set(i.assignedUserId, []);
    groups.get(i.assignedUserId).push(i);
  }
  const rows = users
    .filter((u) => (u.active && u.role !== 'manager') || groups.has(u.uid))
    .map((u) => ({ id: u.uid, name: u.name, department: u.department || '—', ...summarize(groups.get(u.uid) || []) }));
  for (const [uid, list] of groups) {
    if (!users.some((u) => u.uid === uid)) rows.push({ id: uid, name: list[0].assignedUserName || 'Unknown user', department: '—', ...summarize(list) });
  }
  return rows.sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));
}

export function byDepartment(indents, users) {
  const deptOf = new Map(users.map((u) => [u.uid, u.department || 'No department']));
  const groups = new Map();
  for (const i of indents) {
    if (!i.assignedUserId) continue;
    const d = deptOf.get(i.assignedUserId) || 'No department';
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(i);
  }
  return [...groups.entries()].map(([name, list]) => ({ id: name, name, ...summarize(list) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** On-time vs late receipts per month (by actual receiving date). */
export function monthly(list, months, today) {
  const out = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
    out.push({ label: d.toLocaleString('en-IN', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2), y: d.getFullYear(), m: d.getMonth(), onTime: 0, late: 0 });
  }
  for (const i of list) {
    if (i.status !== STATUS.DONE_ON_TIME && i.status !== STATUS.DONE_LATE) continue;
    const a = toDate(i.actualReceivingDate);
    const row = out.find((r) => r.y === a.getFullYear() && r.m === a.getMonth());
    if (row) i.status === STATUS.DONE_ON_TIME ? row.onTime++ : row.late++;
  }
  return out;
}
