import { useMemo, useState } from 'react';
import { Modal, ErrorText } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { assignIndents } from '../services/db.js';
import { fromInputValue, toInputValue } from '../utils/dates.js';

export default function AssignModal({ items, users, onClose, onDone }) {
  const { profile } = useAuth();
  const [uid, setUid] = useState('');
  const [poRequired, setPoRequired] = useState('');
  const [expectedPo, setExpectedPo] = useState('');
  const [expectedRcv, setExpectedRcv] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const groups = useMemo(() => {
    const m = new Map();
    items.forEach((i) => m.set(i.documentNumber, [...(m.get(i.documentNumber) || []), i]));
    return [...m.entries()];
  }, [items]);
  const reassigning = items.filter((i) => i.assignedUserId).length;
  const active = users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name));
  const minDate = toInputValue(new Date());

  async function save() {
    const user = active.find((u) => u.uid === uid);
    if (!user) return setErr('Choose the responsible employee.');
    if (expectedPo && expectedRcv && expectedRcv < expectedPo) return setErr('Expected Receiving Date cannot be before the Expected PO Date.');
    setBusy(true);
    setErr('');
    try {
      await assignIndents(items, user, {
        poRequired: poRequired === '' ? undefined : poRequired === 'yes',
        expectedPoDate: fromInputValue(expectedPo),
        expectedReceivingDate: fromInputValue(expectedRcv),
        remarks: remarks.trim(),
      }, profile);
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Assign ${items.length} item${items.length === 1 ? '' : 's'}`} onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Assigning…' : 'Assign'}</button>
        </>
      }>
      <ul className="mb-5 max-h-40 space-y-2 overflow-y-auto rounded-md bg-canvas p-3 text-sm">
        {groups.map(([docNo, list]) => (
          <li key={docNo}>
            <div className="font-medium">{docNo}</div>
            <div className="text-steel">{list.map((i) => i.displayName || i.itemCode).join(', ')}</div>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="as-user">Assign to</label>
          <select id="as-user" className="field" value={uid} onChange={(e) => setUid(e.target.value)}>
            <option value="">Choose employee…</option>
            {active.map((u) => <option key={u.uid} value={u.uid}>{u.name}{u.department ? ` (${u.department})` : ''}</option>)}
          </select>
          {reassigning > 0 && <p className="mt-1 text-xs text-amber-800">{reassigning} of these are already assigned and will move to the new person.</p>}
        </div>
        <div>
          <label className="label" htmlFor="as-po">PO Required</label>
          <select id="as-po" className="field" value={poRequired} onChange={(e) => setPoRequired(e.target.value)}>
            <option value="">Keep current (new indents: Yes)</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="as-podate">Expected PO Date</label>
          <input id="as-podate" type="date" className="field" min={minDate} value={expectedPo} onChange={(e) => setExpectedPo(e.target.value)} disabled={poRequired === 'no'} />
        </div>
        <div>
          <label className="label" htmlFor="as-rcv">Expected Receiving Date</label>
          <input id="as-rcv" type="date" className="field" min={minDate} value={expectedRcv} onChange={(e) => setExpectedRcv(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="as-rem">Remarks (optional)</label>
          <input id="as-rem" className="field" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <p className="text-xs text-steel sm:col-span-2">Empty dates keep each item's current value.</p>
        <div className="sm:col-span-2"><ErrorText>{err}</ErrorText></div>
      </div>
    </Modal>
  );
}
