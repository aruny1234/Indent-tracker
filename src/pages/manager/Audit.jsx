import { useEffect, useMemo, useState } from 'react';
import { PageHeader, ErrorText } from '../../components/ui.jsx';
import { watchAudit } from '../../services/db.js';
import { fmtDateTime } from '../../utils/dates.js';

const FIELD = {
  assignedUserName: 'Assigned to', expectedReceivingDate: 'Expected date', actualReceivingDate: 'Received date', remarks: 'Remarks',
};

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => watchAudit(setLogs, (e) => setErr(e.message)), []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? logs.filter((l) => [l.documentNumber, l.itemCode, l.userName, l.action].some((v) => String(v || '').toLowerCase().includes(s))) : logs;
  }, [logs, q]);

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every assignment and date change, newest first (last 300 entries)." />
      <input className="field mb-4 max-w-sm" type="search" placeholder="Search indent, item or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
      <ErrorText>{err}</ErrorText>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas"><tr><th className="th">When</th><th className="th">By</th><th className="th">Action</th><th className="th">Indent</th><th className="th">Change</th></tr></thead>
          <tbody className="divide-y divide-line">
            {shown.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap tabular-nums">{fmtDateTime(l.timestamp)}</td>
                <td className="td whitespace-nowrap">{l.userName}</td>
                <td className="td whitespace-nowrap">{l.action}</td>
                <td className="td whitespace-nowrap"><div>{l.documentNumber}</div><div className="text-xs text-steel">{l.itemCode}</div></td>
                <td className="td min-w-[260px]">
                  {Object.keys(l.newValue || {}).map((k) => (
                    <div key={k}><span className="text-steel">{FIELD[k] || k}:</span> {l.oldValue?.[k]} → <span className="font-medium">{l.newValue[k]}</span></div>
                  ))}
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td className="td py-8 text-center text-steel" colSpan={5}>No audit entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
