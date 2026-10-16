import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Loading, ConfirmDialog } from '../../components/ui.jsx';
import IndentList from '../../components/IndentList.jsx';
import IndentModal from '../../components/IndentModal.jsx';
import AssignModal from '../../components/AssignModal.jsx';
import { filterIndents } from '../../utils/filters.js';
import { OVERALL_LIST, PO_LIST, MAT_LIST, sortIndents } from '../../utils/status.js';
import { exportIndents } from '../../utils/exportExcel.js';
import { deleteIndent } from '../../services/db.js';
import { fmtDate, fromInputValue } from '../../utils/dates.js';

export default function Indents() {
  const { profile } = useAuth();
  const { indents, users, loaded } = useData();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const assignee = params.get('assignee') || '';
  const due = params.get('due') || '';
  const dueStage = params.get('stage') || 'rcv';
  const batch = params.get('batch') || '';
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  const setParam = (k, v) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    if (k === 'due' && !v) p.delete('stage');
    setParams(p, { replace: true });
  };

  const orderTypes = useMemo(() => [...new Set(indents.map((i) => i.orderType).filter(Boolean))].sort(), [indents]);
  const existingIds = useMemo(() => new Set(indents.map((i) => i.id)), [indents]);
  const rows = useMemo(
    () => filterIndents(indents, { search, status, assignee, orderType, due, dueStage, batch }).sort(sortIndents),
    [indents, search, status, assignee, orderType, due, dueStage, batch]
  );
  const selectedItems = indents.filter((i) => selected.has(i.id));
  const openIndent = indents.find((i) => i.id === openId);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set());

  async function confirmDelete() {
    setDelBusy(true);
    setDelErr('');
    try {
      await deleteIndent(toDelete, profile);
      setSelected((s) => { const n = new Set(s); n.delete(toDelete.id); return n; });
      setToDelete(null);
    } catch (e) {
      setDelErr(e.message);
    }
    setDelBusy(false);
  }

  if (!loaded) return <Loading />;

  return (
    <div>
      <PageHeader title="Indents" subtitle={`${rows.length} of ${indents.length} items shown`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => exportIndents(rows)} disabled={!rows.length}>Export to Excel</button>
            <button className="btn-primary" onClick={() => setAssigning(true)} disabled={!selected.size}>Assign selected{selected.size ? ` (${selected.size})` : ''}</button>
          </>
        } />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className="field" type="search" placeholder="Search indent, item, PO no., remarks" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select className="field" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="open">All open</option>
          <option value="done">Completed</option>
          <optgroup label="Overall status">{OVERALL_LIST.map((s) => <option key={s} value={`o:${s}`}>{s}</option>)}</optgroup>
          <optgroup label="PO status">{PO_LIST.map((s) => <option key={s} value={`p:${s}`}>{s}</option>)}</optgroup>
          <optgroup label="Material status">{MAT_LIST.map((s) => <option key={s} value={`m:${s}`}>{s}</option>)}</optgroup>
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

      {(due || batch || selected.size > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {due && (
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-light px-3 py-1 text-teal-dark">
              {dueStage === 'po' ? 'PO due' : 'Receiving due'} on {fmtDate(fromInputValue(due))}
              <button onClick={() => setParam('due', '')} aria-label="Remove date filter">✕</button>
            </span>
          )}
          {batch && (
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-light px-3 py-1 text-teal-dark">
              Batch {batch}
              <button onClick={() => setParam('batch', '')} aria-label="Remove batch filter">✕</button>
            </span>
          )}
          {selected.size > 0 && <button className="text-steel hover:underline" onClick={() => setSelected(new Set())}>Clear selection</button>}
        </div>
      )}

      <IndentList rows={rows} onOpen={(r) => setOpenId(r.id)} onDelete={(r) => { setDelErr(''); setToDelete(r); }}
        selectable selected={selected} onToggle={toggle} onToggleAll={toggleAll} />

      {openIndent && <IndentModal indent={openIndent} users={users} existingIds={existingIds} onClose={() => setOpenId(null)} />}
      {assigning && (
        <AssignModal items={selectedItems} users={users} onClose={() => setAssigning(false)}
          onDone={() => { setAssigning(false); setSelected(new Set()); }} />
      )}
      {toDelete && (
        <ConfirmDialog title="Delete indent" message="Are you sure you want to delete this indent?"
          detail={<>{toDelete.documentNumber}, {toDelete.displayName || toDelete.itemCode}{toDelete.assignedUserName ? `, assigned to ${toDelete.assignedUserName}` : ''}. This cannot be undone. The deletion is recorded in the audit log.</>}
          busy={delBusy} error={delErr} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
