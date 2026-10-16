import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Loading, EmptyState, StatRow, StageCell, otdTone } from '../../components/ui.jsx';
import DueStrip from '../../components/DueStrip.jsx';
import { summarize, byEmployee, byDepartment } from '../../utils/performance.js';
import { PO, MAT, OVERALL, sortIndents, poHint, materialHint } from '../../utils/status.js';
import { fmtDate, toInputValue } from '../../utils/dates.js';

const pctText = (v) => (v == null ? '—' : `${v}%`);

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
                <th className="th" rowSpan={2}>{firstCol}</th>
                {showDept && <th className="th" rowSpan={2}>Department</th>}
                <th className="th text-right" rowSpan={2}>Assigned</th>
                <th className="th border-l border-line text-center" colSpan={4}>Stage 1: PO</th>
                <th className="th border-l border-line text-center" colSpan={4}>Stage 2: Material</th>
                <th className="th border-l border-line text-right" rowSpan={2}>Completed</th>
              </tr>
              <tr>
                <th className="th border-l border-line text-right">Pending</th>
                <th className="th text-right">Overdue</th>
                <th className="th text-right">On time %</th>
                <th className="th text-right">Avg delay</th>
                <th className="th border-l border-line text-right">Pending</th>
                <th className="th text-right">Overdue</th>
                <th className="th text-right">On time %</th>
                <th className="th text-right">Avg delay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.name}</td>
                  {showDept && <td className="td text-steel">{r.department}</td>}
                  <td className="td text-right">{r.total}</td>
                  <td className="td border-l border-line text-right">{r.poPending + r.assigned}</td>
                  <td className={`td text-right ${r.poOverdue ? 'font-semibold text-red-700' : ''}`}>{r.poOverdue}</td>
                  <td className={`td text-right font-medium ${otdTone(r.poOtd)}`}>{pctText(r.poOtd)}</td>
                  <td className="td text-right">{r.poDelayed ? `${r.poAvgDelay} d` : '—'}</td>
                  <td className="td border-l border-line text-right">{r.materialPending}</td>
                  <td className={`td text-right ${r.matOverdue ? 'font-semibold text-red-700' : ''}`}>{r.matOverdue}</td>
                  <td className={`td text-right font-medium ${otdTone(r.matOtd)}`}>{pctText(r.matOtd)}</td>
                  <td className="td text-right">{r.matDelayed ? `${r.matAvgDelay} d` : '—'}</td>
                  <td className="td border-l border-line text-right">{r.completed}</td>
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
    () => indents.filter((i) => [PO.OVERDUE, PO.DUE_TODAY].includes(i.poStatus) || [MAT.OVERDUE, MAT.DUE_TODAY].includes(i.materialStatus)).sort(sortIndents).slice(0, 10),
    [indents]
  );
  const go = (qs) => navigate(`/indents?${qs}`);
  const st = (prefix, v) => go(`status=${encodeURIComponent(prefix + v)}`);

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
      <PageHeader title="Dashboard" subtitle={`Today is ${fmtDate(today)}`} actions={<Link className="btn-primary" to="/import">Import NetSuite Excel</Link>} />

      <StatRow items={[
        { label: 'Total indents', value: s.total, onClick: () => go('') },
        { label: 'Pending assignment', value: s.pendingAssignment, tone: s.pendingAssignment ? 'text-amber-700' : '', onClick: () => st('o:', OVERALL.PENDING_ASSIGNMENT) },
        { label: 'Assigned (no target yet)', value: s.assigned, onClick: () => st('o:', OVERALL.ASSIGNED) },
        { label: 'PO pending', value: s.poPending, onClick: () => st('o:', OVERALL.PO_PENDING) },
        { label: 'PO overdue', value: s.poOverdue, tone: s.poOverdue ? 'text-red-700' : '', onClick: () => st('p:', PO.OVERDUE) },
        { label: 'Material pending', value: s.materialPending, onClick: () => st('o:', OVERALL.MATERIAL_PENDING) },
        { label: 'Material overdue', value: s.matOverdue, tone: s.matOverdue ? 'text-red-700' : '', onClick: () => st('m:', MAT.OVERDUE) },
        { label: 'Completed', value: s.completed, onClick: () => go('status=done') },
        { label: 'PO on time', value: pctText(s.poOtd), tone: otdTone(s.poOtd) },
        { label: 'Material on time', value: pctText(s.matOtd), tone: otdTone(s.matOtd) },
      ]} />

      <DueStrip indents={indents} today={today}
        onPickOverdue={(stage) => (stage === 'po' ? st('p:', PO.OVERDUE) : st('m:', MAT.OVERDUE))}
        onPickDay={(stage, d) => go(`due=${toInputValue(d)}&stage=${stage}`)} />

      {attention.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Needs follow-up today</h2>
            <Link to="/indents?status=open" className="text-sm text-teal hover:underline">All open items</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas"><tr><th className="th">Indent</th><th className="th">Assigned to</th><th className="th">PO</th><th className="th">Material</th></tr></thead>
              <tbody className="divide-y divide-line">
                {attention.map((i) => (
                  <tr key={i.id}>
                    <td className="td"><div className="font-medium">{i.documentNumber}</div><div className="text-xs text-steel">{i.displayName || i.itemCode}</div></td>
                    <td className="td whitespace-nowrap">{i.assignedUserName || <span className="text-steel">Unassigned</span>}</td>
                    <td className="td"><StageCell status={i.poStatus} hint={poHint(i)} /></td>
                    <td className="td"><StageCell status={i.materialStatus} hint={materialHint(i)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <PerfTable title="Employee performance" rows={employees} firstCol="Employee" showDept />
      <PerfTable title="Department performance" rows={departments} firstCol="Department" />
      <p className="text-xs text-steel">
        On time % for each stage = done on or before the expected date ÷ (on time + done late + still overdue).
        Avg delay = average days late for items done late. PO pending includes assigned items still waiting for a PO target date.
      </p>
    </div>
  );
}
