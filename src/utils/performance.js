import { OVERALL, PO, MAT, PERF } from './status.js';
import { toDate } from './dates.js';

const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

/**
 * On-time % for each stage = on-time / (on-time + delayed + currently overdue).
 * Overdue items count as misses before they are done, so leaving work open never improves the score.
 */
export function summarize(list) {
  const s = {
    total: list.length, pendingAssignment: 0, assigned: 0, poPending: 0, materialPending: 0, completed: 0,
    poOverdue: 0, poDue: 0, poCreated: 0, poOnTime: 0, poDelayed: 0, poDelaySum: 0,
    matOverdue: 0, matDue: 0, matOnTime: 0, matDelayed: 0, matDelaySum: 0,
  };
  for (const i of list) {
    if (i.overallStatus === OVERALL.PENDING_ASSIGNMENT) s.pendingAssignment++;
    else if (i.overallStatus === OVERALL.ASSIGNED) s.assigned++;
    else if (i.overallStatus === OVERALL.PO_PENDING) s.poPending++;
    else if (i.overallStatus === OVERALL.MATERIAL_PENDING) s.materialPending++;
    else if (i.overallStatus === OVERALL.COMPLETED) s.completed++;

    if (i.poStatus === PO.OVERDUE) s.poOverdue++;
    if (i.poStatus === PO.DUE_TODAY || i.poStatus === PO.DUE_SOON) s.poDue++;
    if (i.poStatus === PO.CREATED) s.poCreated++;
    if (i.poPerformance === PERF.ON_TIME) s.poOnTime++;
    if (i.poPerformance === PERF.DELAYED) { s.poDelayed++; s.poDelaySum += i.poDelayDays; }

    if (i.materialStatus === MAT.OVERDUE) s.matOverdue++;
    if (i.materialStatus === MAT.DUE_TODAY || i.materialStatus === MAT.DUE_SOON) s.matDue++;
    if (i.materialPerformance === PERF.ON_TIME) s.matOnTime++;
    if (i.materialPerformance === PERF.DELAYED) { s.matDelayed++; s.matDelaySum += i.materialDelayDays; }
  }
  s.open = s.total - s.completed;
  s.poOtd = pct(s.poOnTime, s.poOnTime + s.poDelayed + s.poOverdue);
  s.matOtd = pct(s.matOnTime, s.matOnTime + s.matDelayed + s.matOverdue);
  s.poAvgDelay = s.poDelayed ? +(s.poDelaySum / s.poDelayed).toFixed(1) : 0;
  s.matAvgDelay = s.matDelayed ? +(s.matDelaySum / s.matDelayed).toFixed(1) : 0;
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
  return rows.sort((a, b) => b.poOverdue + b.matOverdue - (a.poOverdue + a.matOverdue) || b.total - a.total || a.name.localeCompare(b.name));
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

/** On-time vs delayed per month. stage 'po' uses PO creation date, 'mat' uses actual receiving date. */
export function monthly(list, months, today, stage) {
  const out = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
    out.push({ label: d.toLocaleString('en-IN', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2), y: d.getFullYear(), m: d.getMonth(), onTime: 0, late: 0 });
  }
  for (const i of list) {
    const perf = stage === 'po' ? i.poPerformance : i.materialPerformance;
    if (!perf) continue;
    const d = toDate(stage === 'po' ? i.poCreationDate : i.actualReceivingDate);
    const row = out.find((r) => r.y === d.getFullYear() && r.m === d.getMonth());
    if (row) perf === PERF.ON_TIME ? row.onTime++ : row.late++;
  }
  return out;
}
