import { isDone, STATUS } from '../utils/status.js';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Open items per expected-receiving day for the next 14 days, with the overdue backlog on the left. */
export default function ReceivingStrip({ indents, today, onPickOverdue, onPickDay }) {
  const open = indents.filter((i) => !isDone(i.status) && i.daysLeft != null);
  const overdue = open.filter((i) => i.status === STATUS.OVERDUE).length;
  const days = Array.from({ length: 14 }, (_, k) => {
    const d = new Date(today);
    d.setDate(d.getDate() + k);
    return { k, d, count: open.filter((i) => i.daysLeft === k).length };
  });
  const max = Math.max(1, overdue, ...days.map((x) => x.count));
  const tone = (k) => (k <= 3 ? 'bg-orange-400' : k <= 7 ? 'bg-amber-300' : 'bg-sky-300');

  const Bar = ({ count, color, label, sub, onClick, strong }) => (
    <button onClick={onClick} disabled={!count}
      className="group flex h-full min-w-[40px] flex-1 flex-col items-center justify-end rounded-md px-0.5 pt-1 enabled:hover:bg-canvas"
      aria-label={`${label} ${sub}: ${count} items`}>
      <span className={`text-xs tabular-nums ${count ? 'font-semibold text-ink' : 'text-slate-300'}`}>{count}</span>
      <div className="flex w-full flex-1 items-end px-1">
        <div className={`w-full rounded-sm ${count ? color : 'bg-slate-100'}`} style={{ height: `${Math.max(3, (count / max) * 100)}%` }} />
      </div>
      <span className={`mt-1.5 text-[11px] ${strong ? 'font-semibold text-ink' : 'text-steel'}`}>{label}</span>
      <span className="text-[11px] tabular-nums text-steel">{sub}</span>
    </button>
  );

  return (
    <section className="panel p-4 md:p-5">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-semibold">Receiving schedule, next 14 days</h2>
        <p className="text-xs text-steel">Open items by expected receiving date. Click a day to see them.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="flex h-44 min-w-[620px] items-stretch gap-1">
          <Bar count={overdue} color="bg-red-500" label="Overdue" sub="backlog" onClick={onPickOverdue} strong />
          <div className="mx-1 w-px self-stretch bg-line" />
          {days.map(({ k, d, count }) => (
            <Bar key={k} count={count} color={tone(k)} label={k === 0 ? 'Today' : WEEKDAY[d.getDay()]} sub={d.getDate()} onClick={() => onPickDay(d)} strong={k === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
