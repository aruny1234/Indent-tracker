import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Loading, EmptyState, StatRow, StatusCell } from '../../components/ui.jsx';
import ReceivingStrip from '../../components/ReceivingStrip.jsx';
import { summarize, byEmployee, byDepartment } from '../../utils/performance.js';
import { STATUS, sortIndents } from '../../utils/status.js';
import { fmtDate, toInputValue } from '../../utils/dates.js';

function PerfTable({ title, rows, firstCol, showDept }) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 font-semibold">{title}</h2>
      {!rows.length ? (
        <p className="px-4 py-6 text-sm text-steel">Nothing assigned yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="th">{firstCol}</th>
                {showDept && <th className="th">Department</th>}
                <th className="th text-right">Assigned</th>
                <th className="th text-right">Open</th>
                <th className="th text-right">Overdue</th>
                <th className="th text-right">On time</th>
                <th className="th text-right">Late</th>
                <th className="th text-right" title="On-time delivery: on-time receipts ÷ (on-time + late + overdue)">OTD %</th>
                <th className="th text-right">Avg delay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.name}</td>
                  {showDept && <td className="td text-steel">{r.department}</td>}
                  <td className="td text-right">{r.total}</td>
                  <td className="td text-right">{r.open}</td>
                  <td className={`td text-right ${r.overdue ? 'font-semibold text-red-700' : ''}`}>{r.overdue}</td>
                  <td className="td text-right">{r.onTime}</td>
                  <td className="td text-right">{r.late}</td>
                  <td className={`td text-right font-medium ${r.otd == null ? 'text-steel' : r.otd >= 90 ? 'text-emerald-700' : r.otd >= 75 ? 'text-amber-700' : 'text-red-700'}`}>
                    {r.otd == null ? '—' : `${r.otd}%`}
                  </td>
                  <td className="td text-right">{r.late ? `${r.avgDelay} d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { indents, users, today, loaded } = useData();
  const navigate = useNavigate();
  const s = useMemo(() => summarize(indents), [indents]);
  const employees = useMemo(() => byEmployee(indents, users), [indents, users]);
  const departments = useMemo(() => byDepartment(indents, users), [indents, users]);
  const attention = useMemo(
    () => indents.filter((i) => i.status === STATUS.OVERDUE || i.status === STATUS.URGENT).sort(sortIndents).slice(0, 8),
    [indents]
  );
  const unassigned = indents.filter((i) => !i.assignedUserId).length;
  const go = (qs) => navigate(`/indents?${qs}`);

  if (!loaded) return <Loading />;
  if (!indents.length)
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState title="No indents yet" text="Import the NetSuite Purchase Requisition export to start tracking."
          action={<Link className="btn-primary" to="/import">Import NetSuite Excel</Link>} />
      </>
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Today is ${fmtDate(today)}`}
        actions={<Link className="btn-primary" to="/import">Import NetSuite Excel</Link>} />

      <ReceivingStrip indents={indents} today={today}
        onPickOverdue={() => go(`status=${encodeURIComponent(STATUS.OVERDUE)}`)}
        onPickDay={(d) => go(`due=${toInputValue(d)}`)} />

      <StatRow items={[
        { label: 'Indent items', value: s.total, onClick: () => go('') },
        { label: 'Unassigned', value: unassigned, tone: unassigned ? 'text-amber-700' : '', onClick: () => go('assignee=__none') },
        { label: 'Overdue', value: s.overdue, tone: s.overdue ? 'text-red-700' : '', onClick: () => go(`status=${encodeURIComponent(STATUS.OVERDUE)}`) },
        { label: 'Due within 7 days', value: s.urgent + s.dueSoon, onClick: () => go('status=open') },
        { label: 'Completed', value: s.completed, onClick: () => go('status=done') },
        { label: 'On-time delivery', value: s.otd == null ? '—' : `${s.otd}%` },
      ]} />

      {attention.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Needs follow-up</h2>
            <Link to={`/indents?status=open`} className="text-sm text-teal hover:underline">All open items</Link>
          </div>
          <ul className="divide-y divide-line">
            {attention.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{i.documentNumber}</div>
                  <div className="truncate text-steel">{i.displayName || i.itemCode}. {i.assignedUserName || 'Unassigned'}</div>
                </div>
                <StatusCell indent={i} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <PerfTable title="Employee performance" rows={employees} firstCol="Employee" showDept />
      <PerfTable title="Department performance" rows={departments} firstCol="Department" />
      <p className="text-xs text-steel">
        OTD % (on-time delivery) = items received on or before the expected date ÷ (on time + received late + still overdue).
        Avg delay is the average number of days late for items received late.
      </p>
    </div>
  );
}
