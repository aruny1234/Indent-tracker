import { useMemo, useState } from 'react';
import { Modal, ErrorText } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { assignIndents } from '../services/db.js';
import { fromInputValue, toInputValue } from '../utils/dates.js';

export default function AssignModal({ items, users, onClose, onDone }) {
  const { profile } = useAuth();
  const [uid, setUid] = useState('');
  const [expected, setExpected] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const groups = useMemo(() => {
    const m = new Map();
    items.forEach((i) => m.set(i.documentNumber, [...(m.get(i.documentNumber) || []), i]));
    return [...m.entries()];
  }, [items]);
  const withoutDate = items.filter((i) => !i.expectedReceivingDate).length;
  const reassigning = items.filter((i) => i.assignedUserId).length;
  const active = users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name));

  async function save() {
    const user = active.find((u) => u.uid === uid);
    if (!user) return setErr('Choose the responsible employee.');
    setBusy(true);
    setErr('');
    try {
      await assignIndents(items, user, fromInputValue(expected), remarks.trim(), profile);
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Assign ${items.length} item${items.length === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Assigning…' : 'Assign'}</button>
        </>
      }
    >
      <ul className="mb-5 max-h-44 space-y-2 overflow-y-auto rounded-md bg-canvas p-3 text-sm">
        {groups.map(([docNo, list]) => (
          <li key={docNo}>
            <div className="font-medium">{docNo}</div>
            <div className="text-steel">{list.map((i) => i.displayName || i.itemCode).join(', ')}</div>
          </li>
        ))}
      </ul>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="as-user">Assign to</label>
          <select id="as-user" className="field" value={uid} onChange={(e) => setUid(e.target.value)}>
            <option value="">Choose employee…</option>
            {active.map((u) => (
              <option key={u.uid} value={u.uid}>{u.name}{u.department ? ` (${u.department})` : ''}</option>
            ))}
          </select>
          {reassigning > 0 && <p className="mt-1 text-xs text-amber-800">{reassigning} of these are already assigned and will move to the new person.</p>}
        </div>
        <div>
          <label className="label" htmlFor="as-date">Expected receiving date</label>
          <input id="as-date" type="date" className="field" min={toInputValue(new Date())} value={expected} onChange={(e) => setExpected(e.target.value)} />
          <p className="mt-1 text-xs text-steel">
            Leave empty to keep each item's current date.
            {!expected && withoutDate > 0 && ` ${withoutDate} item${withoutDate === 1 ? ' has' : 's have'} no date yet and will stay Not Scheduled.`}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="as-rem">Remarks (optional)</label>
          <textarea id="as-rem" rows={2} className="field" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </Modal>
  );
}
