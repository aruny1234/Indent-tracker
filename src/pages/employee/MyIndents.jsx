import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader, Loading, EmptyState } from '../../components/ui.jsx';
import IndentList from '../../components/IndentList.jsx';
import IndentModal from '../../components/IndentModal.jsx';
import { filterIndents } from '../../utils/filters.js';
import { PO, MAT, OVERALL, sortIndents } from '../../utils/status.js';

const CHIPS = [
  { label: 'Open', fn: (i) => i.overallStatus !== OVERALL.COMPLETED },
  { label: 'PO overdue', fn: (i) => i.poStatus === PO.OVERDUE, tone: 'text-red-700' },
  { label: 'PO due', fn: (i) => i.poStatus === PO.DUE_TODAY || i.poStatus === PO.DUE_SOON, tone: 'text-amber-700' },
  { label: 'Material overdue', fn: (i) => i.materialStatus === MAT.OVERDUE, tone: 'text-red-700' },
  { label: 'Receiving due', fn: (i) => i.materialStatus === MAT.DUE_TODAY || i.materialStatus === MAT.DUE_SOON, tone: 'text-amber-700' },
  { label: 'Completed', fn: (i) => i.overallStatus === OVERALL.COMPLETED },
  { label: 'All', fn: () => true },
];

export default function MyIndents() {
  const { profile } = useAuth();
  const { indents, loaded } = useData();
  const [chip, setChip] = useState(0);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const rows = useMemo(() => filterIndents(indents.filter(CHIPS[chip].fn), { search }).sort(sortIndents), [indents, chip, search]);
  const openIndent = indents.find((i) => i.id === openId);

  if (!loaded) return <Loading />;

  return (
    <div>
      <PageHeader title="My indents" subtitle={`Hello ${profile.name.split(' ')[0]}. Enter the PO date and number when the PO is created, then the receiving date when material arrives.`} />
      {!indents.length ? (
        <EmptyState title="Nothing assigned to you yet" text="When the manager assigns indents to you, they appear here." />
      ) : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {CHIPS.map((c, idx) => {
              const n = indents.filter(c.fn).length;
              return (
                <button key={c.label} onClick={() => setChip(idx)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${chip === idx ? 'border-teal bg-teal-light font-medium text-teal-dark' : 'border-line bg-white text-ink hover:bg-canvas'}`}>
                  {c.label} <span className={`tabular-nums ${n && c.tone ? c.tone : 'text-steel'}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <input className="field mb-4 max-w-md" type="search" placeholder="Search indent number, item or PO number" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          <IndentList rows={rows} onOpen={(r) => setOpenId(r.id)} showAssignee={false} />
        </>
      )}
      {openIndent && <IndentModal indent={openIndent} onClose={() => setOpenId(null)} />}
    </div>
  );
}
