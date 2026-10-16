import { OVERALL } from './status.js';
import { toInputValue } from './dates.js';

/**
 * status values: '' | 'open' | 'done' | 'o:<overall>' | 'p:<PO status>' | 'm:<material status>'
 * due + dueStage ('po' | 'rcv'): items whose open stage is due on that date.
 */
export function matchStatus(i, status) {
  if (!status) return true;
  if (status === 'open') return i.overallStatus !== OVERALL.COMPLETED;
  if (status === 'done') return i.overallStatus === OVERALL.COMPLETED;
  const kind = status.slice(0, 2);
  const value = status.slice(2);
  if (kind === 'o:') return i.overallStatus === value;
  if (kind === 'p:') return i.poStatus === value;
  if (kind === 'm:') return i.materialStatus === value;
  return true;
}

export function filterIndents(list, { search = '', status = '', assignee = '', orderType = '', due = '', dueStage = 'rcv', batch = '' } = {}) {
  const q = search.trim().toLowerCase();
  return list.filter((i) => {
    if (!matchStatus(i, status)) return false;
    if (assignee === '__none') {
      if (i.assignedUserId) return false;
    } else if (assignee && i.assignedUserId !== assignee) return false;
    if (orderType && i.orderType !== orderType) return false;
    if (batch && i.importBatchId !== batch) return false;
    if (due) {
      if (dueStage === 'po' ? i.poDaysLeft == null : i.rcvDaysLeft == null) return false;
      if (toInputValue(dueStage === 'po' ? i.expectedPoDate : i.expectedReceivingDate) !== due) return false;
    }
    if (q) {
      const hay = [i.documentNumber, i.itemCode, i.displayName, i.createdBy, i.assignedUserName, i.poNumber, i.remarks, i.importBatchId];
      if (!hay.some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
    }
    return true;
  });
}
