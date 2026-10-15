import { useMemo } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Loading, StatRow } from '../../components/ui.jsx';
import { summarize, monthly } from '../../utils/performance.js';

export default function MyPerformance() {
  const { indents, loaded, today } = useData();
  const s = useMemo(() => summarize(indents), [indents]);
  const months = useMemo(() => monthly(indents, 6, today), [indents, today]);
  const max = Math.max(1, ...months.map((m) => m.onTime + m.late));

  if (!loaded) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="My performance" subtitle="Based on the expected receiving date set by your manager and the date you entered as received." />

      <section className="panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className={`text-5xl font-semibold tabular-nums ${s.otd == null ? 'text-steel' : s.otd >= 90 ? 'text-emerald-700' : s.otd >= 75 ? 'text-amber-700' : 'text-red-700'}`}>
            {s.otd == null ? '—' : `${s.otd}%`}
          </div>
          <p className="max-w-lg text-sm text-steel">
            On-time delivery. {s.onTime} item{s.onTime === 1 ? '' : 's'} received on or before the expected date, out of {s.onTime + s.late + s.overdue} that were due.
            Items that are still overdue count as late.
          </p>
        </div>
      </section>

      <StatRow items={[
        { label: 'Assigned to me', value: s.total },
        { label: 'Open', value: s.open },
        { label: 'Overdue now', value: s.overdue, tone: s.overdue ? 'text-red-700' : '' },
        { label: 'Received on time', value: s.onTime },
        { label: 'Received late', value: s.late },
        { label: 'Average delay', value: s.late ? `${s.avgDelay} d` : '—' },
      ]} />

      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Receipts by month</h2>
          <div className="flex gap-4 text-xs text-steel">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />On time</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Late</span>
          </div>
        </div>
        <div className="space-y-2">
          {months.map((m) => (
            <div key={m.label} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-steel">{m.label}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-canvas">
                <div className="bg-emerald-500" style={{ width: `${(m.onTime / max) * 100}%` }} />
                <div className="bg-violet-400" style={{ width: `${(m.late / max) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums text-steel">{m.onTime} / {m.late}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
