import { useEffect, useMemo, useState } from 'react';
import { PageHeader, ErrorText } from '../../components/ui.jsx';
import { watchAudit } from '../../services/db.js';
import { fmtDateTime } from '../../utils/dates.js';
import { FIELD_LABELS } from '../../utils/fields.js';

const ACTION_LABEL = {
  DELETE_IMPORT_BATCH: 'Deleted import batch', DELETE_INDENT: 'Deleted indent', EDIT_INDENT: 'Edited',
  ASSIGN: 'Assigned', REASSIGN: 'Reassigned', UNASSIGN: 'Unassigned', PO_CREATED: 'PO created', MATERIAL_RECEIVED: 'Material received',
};

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => watchAudit(setLogs, (e) => setErr(e.message)), []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? logs.filter((l) => [l.documentNumber, l.itemCode, l.userName, l.action, l.batchId].some((v) => String(v || '').toLowerCase().includes(s))) : logs;
  }, [logs, q]);

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every assignment, edit, PO, receipt and deletion, newest first (last 300 entries)." />
      <input className="field mb-4 max-w-sm" type="search" placeholder="Search indent, item, batch or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
      <ErrorText>{err}</ErrorText>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas"><tr><th className="th">When</th><th className="th">By</th><th className="th">Action</th><th className="th">Indent / batch</th><th className="th">Field: old → new</th></tr></thead>
          <tbody className="divide-y divide-line">
            {shown.map((l) => {
              const keys = [...new Set([...Object.keys(l.oldValue || {}), ...Object.keys(l.newValue || {})])];
              const isBatch = l.action === 'DELETE_IMPORT_BATCH';
              return (
                <tr key={l.id} className={l.action?.startsWith('DELETE') ? 'bg-red-50/40' : ''}>
                  <td className="td whitespace-nowrap tabular-nums">{fmtDateTime(l.timestamp)}</td>
                  <td className="td whitespace-nowrap">{l.userName}</td>
                  <td className="td whitespace-nowrap">{ACTION_LABEL[l.action] || l.action}</td>
                  <td className="td whitespace-nowrap">
                    {isBatch ? <div className="font-medium">{l.batchId}</div> : <><div>{l.documentNumber}</div><div className="text-xs text-steel">{l.itemCode}</div></>}
                  </td>
                  <td className="td min-w-[280px]">
                    {keys.map((k) => (
                      <div key={k}>
                        <span className="text-steel">{FIELD_LABELS[k] || k}:</span>{' '}
                        {isBatch ? <span className="font-medium">{l.newValue[k]}</span>
                          : l.action === 'DELETE_INDENT' ? <span>{l.oldValue?.[k]}</span>
                          : <>{l.oldValue?.[k] ?? '—'} → <span className="font-medium">{l.newValue?.[k] ?? '—'}</span></>}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td className="td py-8 text-center text-steel" colSpan={5}>No audit entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
