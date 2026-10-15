import { isDone } from './status.js';
import { toInputValue } from './dates.js';

export function filterIndents(list, { search = '', status = '', assignee = '', orderType = '', due = '' } = {}) {
  const q = search.trim().toLowerCase();
  return list.filter((i) => {
    if (status === 'open' && isDone(i.status)) return false;
    if (status === 'done' && !isDone(i.status)) return false;
    if (status && status !== 'open' && status !== 'done' && i.status !== status) return false;
    if (assignee === '__none') {
      if (i.assignedUserId) return false;
    } else if (assignee && i.assignedUserId !== assignee) return false;
    if (orderType && i.orderType !== orderType) return false;
    if (due && toInputValue(i.expectedReceivingDate) !== due) return false;
    if (q) {
      const hay = [i.documentNumber, i.itemCode, i.displayName, i.createdBy, i.assignedUserName, i.remarks];
      if (!hay.some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
    }
    return true;
  });
}
