import * as XLSX from 'xlsx';
import { fmtDate, dateKey } from './dates.js';
import { delayDays } from './status.js';

export function exportIndents(rows, name = 'indents') {
  const data = rows.map((i) => ({
    'Date': fmtDate(i.date, ''),
    'Document Number': i.documentNumber,
    'Order Type': i.orderType,
    'NetSuite Status': i.netsuiteStatus,
    'Item': i.itemCode,
    'Display Name': i.displayName,
    'PR Quantity': i.quantity,
    'Units': i.units,
    'Last Purchase Price': i.lastPurchasePrice,
    'Created By': i.createdBy,
    'Assigned To': i.assignedUserName || '',
    'Expected Receiving Date': fmtDate(i.expectedReceivingDate, ''),
    'Actual Receiving Date': fmtDate(i.actualReceivingDate, ''),
    'Tracking Status': i.status,
    'Delay (days)': delayDays(i) ?? '',
    'Remarks': i.remarks || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Indents');
  XLSX.writeFile(wb, `${name}_${dateKey(new Date())}.xlsx`);
}
