import { toDate, daysBetween, fmtDate } from './dates.js';

export const STATUS = {
  NOT_SCHEDULED: 'Not Scheduled', // no expected receiving date yet
  PENDING: 'Pending',             // more than 7 days left
  DUE_SOON: 'Due Soon',           // 4-7 days left
  URGENT: 'Urgent',               // 0-3 days left
  OVERDUE: 'Overdue',             // expected date passed, not received
  DONE_ON_TIME: 'Completed - On Time',
  DONE_LATE: 'Completed - Late',
  COMPLETED: 'Completed',         // received, but no expected date was ever set
};

export const OPEN_STATUSES = [STATUS.OVERDUE, STATUS.URGENT, STATUS.DUE_SOON, STATUS.PENDING, STATUS.NOT_SCHEDULED];
export const DONE_STATUSES = [STATUS.DONE_LATE, STATUS.DONE_ON_TIME, STATUS.COMPLETED];
export const ALL_STATUSES = [...OPEN_STATUSES, ...DONE_STATUSES];
export const isDone = (s) => DONE_STATUSES.includes(s);

/** Same rules are repeated in functions/index.js — keep both in sync. */
export function computeStatus(indent, today = new Date()) {
  const exp = toDate(indent.expectedReceivingDate);
  const act = toDate(indent.actualReceivingDate);
  if (act) {
    if (!exp) return STATUS.COMPLETED;
    return daysBetween(exp, act) <= 0 ? STATUS.DONE_ON_TIME : STATUS.DONE_LATE;
  }
  if (!exp) return STATUS.NOT_SCHEDULED;
  const left = daysBetween(today, exp);
  if (left < 0) return STATUS.OVERDUE;
  if (left <= 3) return STATUS.URGENT;
  if (left <= 7) return STATUS.DUE_SOON;
  return STATUS.PENDING;
}

export function daysLeft(indent, today = new Date()) {
  const exp = toDate(indent.expectedReceivingDate);
  return exp ? daysBetween(today, exp) : null;
}

/** Positive = received late by N days, 0 or negative = on time. */
export function delayDays(indent) {
  const exp = toDate(indent.expectedReceivingDate);
  const act = toDate(indent.actualReceivingDate);
  return exp && act ? daysBetween(exp, act) : null;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function statusHint(indent) {
  const s = indent.status;
  if (s === STATUS.DONE_LATE) return `${plural(delayDays(indent), 'day')} late`;
  if (s === STATUS.DONE_ON_TIME) {
    const d = delayDays(indent);
    return d < 0 ? `${plural(-d, 'day')} early` : 'On the day';
  }
  if (s === STATUS.OVERDUE) return `${plural(-indent.daysLeft, 'day')} overdue`;
  if (indent.daysLeft === 0) return 'Due today';
  if (indent.daysLeft != null && !isDone(s)) return `In ${plural(indent.daysLeft, 'day')}`;
  return '';
}

export const STATUS_STYLE = {
  [STATUS.NOT_SCHEDULED]: 'bg-slate-100 text-slate-600 ring-slate-300',
  [STATUS.PENDING]: 'bg-sky-50 text-sky-800 ring-sky-200',
  [STATUS.DUE_SOON]: 'bg-amber-50 text-amber-800 ring-amber-300',
  [STATUS.URGENT]: 'bg-orange-100 text-orange-900 ring-orange-400',
  [STATUS.OVERDUE]: 'bg-red-100 text-red-800 ring-red-300',
  [STATUS.DONE_ON_TIME]: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  [STATUS.DONE_LATE]: 'bg-violet-50 text-violet-800 ring-violet-200',
  [STATUS.COMPLETED]: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

const RANK = Object.fromEntries(ALL_STATUSES.map((s, i) => [s, i]));
export function sortIndents(a, b) {
  return (
    RANK[a.status] - RANK[b.status] ||
    (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999) ||
    String(a.documentNumber).localeCompare(String(b.documentNumber)) ||
    String(a.itemCode).localeCompare(String(b.itemCode))
  );
}

// ---- Alerts ----
export const ALERT_TYPE = { [STATUS.DUE_SOON]: 'due_soon', [STATUS.URGENT]: 'urgent', [STATUS.OVERDUE]: 'overdue' };

export function alertMessage(indent, type) {
  const what = `${indent.documentNumber} (${indent.displayName || indent.itemCode})`;
  const due = fmtDate(indent.expectedReceivingDate);
  if (type === 'overdue') return `OVERDUE: ${what} was expected on ${due} and is not received yet.`;
  if (type === 'urgent') return `URGENT: ${what} is due ${indent.daysLeft === 0 ? 'today' : `in ${plural(indent.daysLeft, 'day')}`} (${due}).`;
  return `Reminder: ${what} is due in ${plural(indent.daysLeft, 'day')} (${due}).`;
}
