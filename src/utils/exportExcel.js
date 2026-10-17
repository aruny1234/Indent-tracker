import * as XLSX from 'xlsx';
import { fmtDate, dateKey } from './dates.js';
import { isPoRequired } from './status.js';

export function exportIndents(rows, name = 'indents') {
  const d = (v) => fmtDate(v, '');
  const data = rows.map((i) => ({
    'Date': d(i.date),
    'Document Number': i.documentNumber,
    'Order Type': i.orderType,
    'NetSuite Status': i.netsuiteStatus,
    'Item Code': i.itemCode,
    'Item Description': i.displayName,
    'Quantity': i.quantity,
    'Units': i.units,
    'Last Purchase Price': i.lastPurchasePrice,
    'Created By': i.createdBy,
    'Department': i.department || '',
    'Location': i.location || '',
    'Subsidiary': i.subsidiary || '',
    'Import Batch': i.importBatchId || '',
    'Assigned To': i.assignedUserName || '',
    'PO Required': isPoRequired(i) ? 'Yes' : 'No',
    'Expected PO Date': d(i.expectedPoDate),
    'PO Creation Date': d(i.poCreationDate),
    'PO Number': i.poNumber || '',
    'PO Status': i.poStatus,
    'PO Delay (days)': i.poDelayDays ?? '',
    'PO Performance': i.poPerformance,
    'PO Remarks': i.poRemarks || '',
    'Expected Receiving Date': d(i.expectedReceivingDate),
    'Actual Receiving Date': d(i.actualReceivingDate),
    'Material Status': i.materialStatus,
    'Material Delay (days)': i.materialDelayDays ?? '',
    'Material Performance': i.materialPerformance,
    'Receiving Remarks': i.receivingRemarks || '',
    'Overall Status': i.overallStatus,
    'Performance Status': i.performanceStatus,
    'Remarks': i.remarks || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Indents');
  XLSX.writeFile(wb, `${name}_${dateKey(new Date())}.xlsx`);
}
