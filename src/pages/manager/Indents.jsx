import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Loading } from '../../components/ui.jsx';
import IndentList from '../../components/IndentList.jsx';
import IndentModal from '../../components/IndentModal.jsx';
import AssignModal from '../../components/AssignModal.jsx';
import { filterIndents } from '../../utils/filters.js';
import { ALL_STATUSES, sortIndents } from '../../utils/status.js';
import { exportIndents } from '../../utils/exportExcel.js';
import { fmtDate, fromInputValue } from '../../utils/dates.js';

export default function Indents() {
  const { indents, users, loaded } = useData();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const assignee = params.get('assignee') || '';
  const due = params.get('due') || '';
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const setParam = (k, v) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  const orderTypes = useMemo(() => [...new Set(indents.map((i) => i.orderType).filter(Boolean))].sort(), [indents]);
  const rows = useMemo(
    () => filterIndents(indents, { search, status, assignee, orderType, due }).sort(sortIndents),
    [indents, search, status, assignee, orderType, due]
  );
  const selectedItems = indents.filter((i) => selected.has(i.id));
  const openIndent = indents.find((i) => i.id === openId);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set());

  if (!loaded) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Indents"
        subtitle={`${rows.length} of ${indents.length} items shown`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => exportIndents(rows)} disabled={!rows.length}>Export to Excel</button>
            <button className="btn-primary" onClick={() => setAssigning(true)} disabled={!selected.size}>
              Assign selected{selected.size ? ` (${selected.size})` : ''}
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className="field" type="search" placeholder="Search indent, item, name, remarks" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select className="field" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="open">All open</option>
          <option value="done">All completed</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="field" value={assignee} onChange={(e) => setParam('assignee', e.target.value)} aria-label="Assigned to">
          <option value="">Everyone</option>
          <option value="__none">Unassigned</option>
          {[...users].sort((a, b) => a.name.localeCompare(b.name)).map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
        </select>
        <select className="field" value={orderType} onChange={(e) => setOrderType(e.target.value)} aria-label="Order type">
          <option value="">All order types</option>
          {orderTypes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {(due || selected.size > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {due && (
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-light px-3 py-1 text-teal-dark">
              Expected on {fmtDate(fromInputValue(due))}
              <button onClick={() => setParam('due', '')} aria-label="Remove date filter">✕</button>
            </span>
          )}
          {selected.size > 0 && <button className="text-steel hover:underline" onClick={() => setSelected(new Set())}>Clear selection</button>}
        </div>
      )}

      <IndentList rows={rows} onOpen={(r) => setOpenId(r.id)} selectable selected={selected} onToggle={toggle} onToggleAll={toggleAll} />

      {openIndent && <IndentModal indent={openIndent} users={users} onClose={() => setOpenId(null)} />}
      {assigning && (
        <AssignModal items={selectedItems} users={users} onClose={() => setAssigning(false)}
          onDone={() => { setAssigning(false); setSelected(new Set()); }} />
      )}
    </div>
  );
}
