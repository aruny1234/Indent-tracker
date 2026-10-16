import { useMemo } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Loading, StatRow, otdTone } from '../../components/ui.jsx';
import { summarize, monthly } from '../../utils/performance.js';

function Bars({ title, months }) {
  const max = Math.max(1, ...months.map((m) => m.onTime + m.late));
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex gap-4 text-xs text-steel">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />On time</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" />Delayed</span>
        </div>
      </div>
      <div className="space-y-2">
        {months.map((m) => (
          <div key={m.label} className="flex items-center gap-3 text-sm">
            <span className="w-14 shrink-0 text-steel">{m.label}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-canvas">
              <div className="bg-emerald-500" style={{ width: `${(m.onTime / max) * 100}%` }} />
              <div className="bg-red-400" style={{ width: `${(m.late / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-steel">{m.onTime} / {m.late}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MyPerformance() {
  const { indents, loaded, today } = useData();
  const s = useMemo(() => summarize(indents), [indents]);
  const po = useMemo(() => monthly(indents, 6, today, 'po'), [indents, today]);
  const mat = useMemo(() => monthly(indents, 6, today, 'mat'), [indents, today]);
  if (!loaded) return <Loading />;
  const pct = (v) => (v == null ? '—' : `${v}%`);

  return (
    <div className="space-y-6">
      <PageHeader title="My performance" subtitle="Measured separately for each stage, against the expected dates." />
      <div className="grid gap-4 sm:grid-cols-2">
        {[['Stage 1: PO created on time', s.poOtd, s.poOnTime, s.poOnTime + s.poDelayed + s.poOverdue],
          ['Stage 2: Material received on time', s.matOtd, s.matOnTime, s.matOnTime + s.matDelayed + s.matOverdue]].map(([label, v, on, base]) => (
          <section key={label} className="panel p-5">
            <div className="text-sm text-steel">{label}</div>
            <div className={`mt-1 text-4xl font-semibold tabular-nums ${otdTone(v)}`}>{pct(v)}</div>
            <p className="mt-1 text-xs text-steel">{on} of {base} due items. Items still overdue count as delayed.</p>
          </section>
        ))}
      </div>
      <StatRow items={[
        { label: 'Assigned to me', value: s.total },
        { label: 'Open', value: s.open },
        { label: 'PO overdue now', value: s.poOverdue, tone: s.poOverdue ? 'text-red-700' : '' },
        { label: 'POs delayed', value: s.poDelayed },
        { label: 'Avg PO delay', value: s.poDelayed ? `${s.poAvgDelay} d` : '—' },
        { label: 'Completed', value: s.completed },
        { label: 'Material pending', value: s.materialPending },
        { label: 'Material overdue now', value: s.matOverdue, tone: s.matOverdue ? 'text-red-700' : '' },
        { label: 'Receipts delayed', value: s.matDelayed },
        { label: 'Avg receiving delay', value: s.matDelayed ? `${s.matAvgDelay} d` : '—' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="POs created by month" months={po} />
        <Bars title="Material received by month" months={mat} />
      </div>
    </div>
  );
}
