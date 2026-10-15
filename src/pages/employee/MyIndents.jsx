import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader, Loading, EmptyState } from '../../components/ui.jsx';
import IndentList from '../../components/IndentList.jsx';
import IndentModal from '../../components/IndentModal.jsx';
import { filterIndents } from '../../utils/filters.js';
import { STATUS, sortIndents } from '../../utils/status.js';
import { summarize } from '../../utils/performance.js';

export default function MyIndents() {
  const { profile } = useAuth();
  const { indents, loaded } = useData();
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const s = useMemo(() => summarize(indents), [indents]);
  const rows = useMemo(() => filterIndents(indents, { status, search }).sort(sortIndents), [indents, status, search]);
  const openIndent = indents.find((i) => i.id === openId);

  const chips = [
    { v: 'open', label: 'Open', n: s.open },
    { v: STATUS.OVERDUE, label: 'Overdue', n: s.overdue, tone: 'text-red-700' },
    { v: STATUS.URGENT, label: 'Urgent', n: s.urgent, tone: 'text-orange-700' },
    { v: STATUS.DUE_SOON, label: 'Due soon', n: s.dueSoon, tone: 'text-amber-700' },
    { v: 'done', label: 'Completed', n: s.completed },
    { v: '', label: 'All', n: s.total },
  ];

  if (!loaded) return <Loading />;

  return (
    <div>
      <PageHeader title={`My indents`} subtitle={`Hello ${profile.name.split(' ')[0]}. Update the received date as soon as material arrives.`} />
      {!indents.length ? (
        <EmptyState title="Nothing assigned to you yet" text="When the manager assigns indents to you, they appear here." />
      ) : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => (
              <button key={c.label} onClick={() => setStatus(c.v)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${status === c.v ? 'border-teal bg-teal-light font-medium text-teal-dark' : 'border-line bg-white text-ink hover:bg-canvas'}`}>
                {c.label} <span className={`tabular-nums ${c.n && c.tone ? c.tone : 'text-steel'}`}>{c.n}</span>
              </button>
            ))}
          </div>
          <input className="field mb-4 max-w-md" type="search" placeholder="Search indent number or item" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          <IndentList rows={rows} onOpen={(r) => setOpenId(r.id)} showAssignee={false} />
        </>
      )}
      {openIndent && <IndentModal indent={openIndent} onClose={() => setOpenId(null)} />}
    </div>
  );
}
