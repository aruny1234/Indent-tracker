import { toDate, daysBetween, fmtDate } from './dates.js';

/*
 * Two-stage procurement tracking:
 *   INDENT -> ASSIGNED -> STAGE 1: PURCHASE ORDER -> STAGE 2: MATERIAL RECEIVING -> COMPLETED
 * All statuses below are CALCULATED. They are never typed in by anyone.
 * The same rules are repeated in functions/index.js: keep both in sync.
 */

export const PO = {
  NOT_REQUIRED: 'NOT REQUIRED',
  PENDING: 'PO PENDING',
  DUE_SOON: 'PO DUE SOON',     // expected PO date within 7 days
  DUE_TODAY: 'PO DUE TODAY',
  OVERDUE: 'PO OVERDUE',
  CREATED: 'PO CREATED',
};

export const MAT = {
  AWAITING_PO: 'AWAITING PO',  // stage 2 not started: PO still to be created
  PENDING: 'MATERIAL PENDING',
  DUE_SOON: 'RECEIVING DUE SOON',
  DUE_TODAY: 'RECEIVING DUE TODAY',
  OVERDUE: 'MATERIAL OVERDUE',
  RECEIVED: 'MATERIAL RECEIVED',
};

export const OVERALL = {
  PENDING_ASSIGNMENT: 'PENDING ASSIGNMENT',
  ASSIGNED: 'ASSIGNED',          // assigned, next target date not set yet
  PO_PENDING: 'PO PENDING',      // stage 1 in progress
  MATERIAL_PENDING: 'MATERIAL PENDING', // stage 2 in progress
  COMPLETED: 'COMPLETED',
};

export const PERF = { ON_TIME: 'ON TIME', DELAYED: 'DELAYED' };

export const PO_LIST = [PO.OVERDUE, PO.DUE_TODAY, PO.DUE_SOON, PO.PENDING, PO.CREATED, PO.NOT_REQUIRED];
export const MAT_LIST = [MAT.OVERDUE, MAT.DUE_TODAY, MAT.DUE_SOON, MAT.PENDING, MAT.AWAITING_PO, MAT.RECEIVED];
export const OVERALL_LIST = [OVERALL.PENDING_ASSIGNMENT, OVERALL.ASSIGNED, OVERALL.PO_PENDING, OVERALL.MATERIAL_PENDING, OVERALL.COMPLETED];

export const isPoRequired = (i) => i.poRequired !== false; // default: Yes

function dueState(target, today) {
  const d = toDate(target);
  if (!d) return { left: null, state: 'none' };
  const left = daysBetween(today, d);
  return { left, state: left < 0 ? 'overdue' : left === 0 ? 'today' : left <= 7 ? 'soon' : 'pending' };
}

/** Adds every calculated field to an indent record. */
export function enrich(i, today = new Date()) {
  const poReq = isPoRequired(i);
  const poCreated = toDate(i.poCreationDate);
  const received = toDate(i.actualReceivingDate);
  const expPo = toDate(i.expectedPoDate);
  const expRcv = toDate(i.expectedReceivingDate);
  const po = dueState(expPo, today);
  const rc = dueState(expRcv, today);

  // Stage 1: purchase order
  let poStatus;
  if (!poReq) poStatus = PO.NOT_REQUIRED;
  else if (poCreated) poStatus = PO.CREATED;
  else poStatus = { overdue: PO.OVERDUE, today: PO.DUE_TODAY, soon: PO.DUE_SOON }[po.state] || PO.PENDING;

  // Stage 2: material receiving (starts once PO is created, or straight away if no PO is needed)
  const stage2Open = !poReq || !!poCreated;
  let materialStatus;
  if (received) materialStatus = MAT.RECEIVED;
  else if (!stage2Open) materialStatus = MAT.AWAITING_PO;
  else materialStatus = { overdue: MAT.OVERDUE, today: MAT.DUE_TODAY, soon: MAT.DUE_SOON }[rc.state] || MAT.PENDING;

  // Overall
  let overallStatus;
  if (received) overallStatus = OVERALL.COMPLETED;
  else if (!i.assignedUserId) overallStatus = OVERALL.PENDING_ASSIGNMENT;
  else if (poReq && !poCreated) overallStatus = expPo ? OVERALL.PO_PENDING : OVERALL.ASSIGNED;
  else if (!poReq && !expRcv) overallStatus = OVERALL.ASSIGNED;
  else overallStatus = OVERALL.MATERIAL_PENDING;

  // Delays and performance (positive delay = late)
  const poDelayDays = poReq && poCreated && expPo ? daysBetween(expPo, poCreated) : null;
  const materialDelayDays = received && expRcv ? daysBetween(expRcv, received) : null;
  const poPerformance = poDelayDays == null ? '' : poDelayDays <= 0 ? PERF.ON_TIME : PERF.DELAYED;
  const materialPerformance = materialDelayDays == null ? '' : materialDelayDays <= 0 ? PERF.ON_TIME : PERF.DELAYED;
  const delayed = poPerformance === PERF.DELAYED || materialPerformance === PERF.DELAYED || poStatus === PO.OVERDUE || materialStatus === MAT.OVERDUE;
  const performanceStatus = delayed ? PERF.DELAYED : overallStatus === OVERALL.COMPLETED ? PERF.ON_TIME : '';

  return {
    ...i,
    poStatus, materialStatus, overallStatus,
    poDelayDays, materialDelayDays, poPerformance, materialPerformance, performanceStatus,
    poDaysLeft: poReq && !poCreated ? po.left : null,
    rcvDaysLeft: stage2Open && !received ? rc.left : null,
  };
}

/** Fields added by enrich(); never written back as data. */
export const COMPUTED_KEYS = ['id', 'poStatus', 'materialStatus', 'overallStatus', 'poDelayDays', 'materialDelayDays',
  'poPerformance', 'materialPerformance', 'performanceStatus', 'poDaysLeft', 'rcvDaysLeft'];

/** Snapshot of the statuses stored on the record (useful for exports and the optional scheduler). */
export const storedStatus = (e) => ({ overallStatus: e.overallStatus, poStatus: e.poStatus, materialStatus: e.materialStatus });

// ---- Display helpers ----
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function dueHint(left, date) {
  if (left == null) return 'No target date';
  if (left < 0) return `${plural(-left, 'day')} overdue`;
  if (left === 0) return 'Due today';
  return `Due ${fmtDate(date)} (${plural(left, 'day')})`;
}

export function poHint(i) {
  if (i.poStatus === PO.NOT_REQUIRED) return '';
  if (i.poStatus === PO.CREATED) {
    return [i.poNumber ? `PO ${i.poNumber}` : '', fmtDate(i.poCreationDate), i.poDelayDays > 0 ? `${plural(i.poDelayDays, 'day')} late` : '']
      .filter(Boolean).join(', ');
  }
  return dueHint(i.poDaysLeft, i.expectedPoDate);
}

export function materialHint(i) {
  if (i.materialStatus === MAT.RECEIVED) {
    return [fmtDate(i.actualReceivingDate), i.materialDelayDays > 0 ? `${plural(i.materialDelayDays, 'day')} late` : ''].filter(Boolean).join(', ');
  }
  if (i.materialStatus === MAT.AWAITING_PO) return i.expectedReceivingDate ? `Target ${fmtDate(i.expectedReceivingDate)}` : '';
  return dueHint(i.rcvDaysLeft, i.expectedReceivingDate);
}

const RED = 'bg-red-100 text-red-800 ring-red-300';
const ORANGE = 'bg-orange-100 text-orange-900 ring-orange-400';
const AMBER = 'bg-amber-50 text-amber-800 ring-amber-300';
const SKY = 'bg-sky-50 text-sky-800 ring-sky-200';
const GREEN = 'bg-emerald-50 text-emerald-800 ring-emerald-200';
const GREY = 'bg-slate-100 text-slate-600 ring-slate-300';

export const STATUS_STYLE = {
  [PO.OVERDUE]: RED, [MAT.OVERDUE]: RED, [PERF.DELAYED]: RED,
  [PO.DUE_TODAY]: ORANGE, [MAT.DUE_TODAY]: ORANGE,
  [PO.DUE_SOON]: AMBER, [MAT.DUE_SOON]: AMBER, [OVERALL.PENDING_ASSIGNMENT]: AMBER,
  [PO.PENDING]: SKY, [MAT.PENDING]: SKY, [OVERALL.ASSIGNED]: SKY,
  [PO.CREATED]: GREEN, [MAT.RECEIVED]: GREEN, [OVERALL.COMPLETED]: GREEN, [PERF.ON_TIME]: GREEN,
  [PO.NOT_REQUIRED]: GREY, [MAT.AWAITING_PO]: GREY,
};

// ---- Sorting: most urgent first ----
function urgency(i) {
  const s = [i.poStatus, i.materialStatus];
  if (s.includes(PO.OVERDUE) || s.includes(MAT.OVERDUE)) return 0;
  if (s.includes(PO.DUE_TODAY) || s.includes(MAT.DUE_TODAY)) return 1;
  if (s.includes(PO.DUE_SOON) || s.includes(MAT.DUE_SOON)) return 2;
  if (i.overallStatus === OVERALL.PENDING_ASSIGNMENT) return 3;
  if (i.overallStatus === OVERALL.COMPLETED) return 5;
  return 4;
}
const nearest = (i) => Math.min(i.poDaysLeft ?? 99999, i.rcvDaysLeft ?? 99999);

export function sortIndents(a, b) {
  return (
    urgency(a) - urgency(b) ||
    nearest(a) - nearest(b) ||
    String(a.documentNumber).localeCompare(String(b.documentNumber)) ||
    String(a.itemCode).localeCompare(String(b.itemCode))
  );
}

// ---- Alerts ----
export const PO_ALERT = { [PO.DUE_SOON]: 'po_due_soon', [PO.DUE_TODAY]: 'po_due_today', [PO.OVERDUE]: 'po_overdue' };
export const MAT_ALERT = { [MAT.DUE_SOON]: 'rcv_due_soon', [MAT.DUE_TODAY]: 'rcv_due_today', [MAT.OVERDUE]: 'rcv_overdue' };

export function alertMessage(i, type) {
  const isPo = type.startsWith('po_');
  const what = `${i.documentNumber} (${i.displayName || i.itemCode})`;
  const date = fmtDate(isPo ? i.expectedPoDate : i.expectedReceivingDate);
  const left = isPo ? i.poDaysLeft : i.rcvDaysLeft;
  const task = isPo ? 'PO creation' : 'Material receiving';
  if (type.endsWith('overdue')) return `OVERDUE: ${task} for ${what} was due on ${date}.`;
  if (type.endsWith('due_today')) return `DUE TODAY: ${task} for ${what} (${date}).`;
  return `Reminder: ${task} for ${what} is due in ${plural(left, 'day')} (${date}).`;
}
