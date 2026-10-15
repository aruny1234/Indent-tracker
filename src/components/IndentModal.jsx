import { useState } from 'react';
import { Modal, StatusCell, ErrorText } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { updateIndent } from '../services/db.js';
import { fmtDate, fmtDateTime, toInputValue, fromInputValue, startOfDay } from '../utils/dates.js';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-steel">{label}</dt>
      <dd className="text-sm">{children || '—'}</dd>
    </div>
  );
}

export default function IndentModal({ indent, users = [], onClose }) {
  const { profile } = useAuth();
  const isManager = profile.role === 'manager';
  const [assignee, setAssignee] = useState(indent.assignedUserId || '');
  const [expected, setExpected] = useState(toInputValue(indent.expectedReceivingDate));
  const [actual, setActual] = useState(toInputValue(indent.actualReceivingDate));
  const [remarks, setRemarks] = useState(indent.remarks || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const todayInput = toInputValue(new Date());

  async function save() {
    setErr('');
    const act = fromInputValue(actual);
    if (act && act > startOfDay(new Date())) return setErr('Actual receiving date cannot be in the future.');
    const changes = {};
    if (isManager) {
      if (assignee !== (indent.assignedUserId || '')) {
        const u = users.find((x) => x.uid === assignee);
        changes.assignedUserId = assignee || null;
        changes.assignedUserName = u?.name || null;
        changes.assignedAt = assignee ? new Date() : null;
      }
      if (expected !== toInputValue(indent.expectedReceivingDate)) changes.expectedReceivingDate = fromInputValue(expected);
    }
    if (actual !== toInputValue(indent.actualReceivingDate)) changes.actualReceivingDate = act;
    if (remarks.trim() !== (indent.remarks || '')) changes.remarks = remarks.trim();
    if (!Object.keys(changes).length) return onClose();
    setBusy(true);
    try {
      await updateIndent(indent, changes, profile);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const activeUsers = users.filter((u) => u.active || u.uid === indent.assignedUserId);

  return (
    <Modal
      title={indent.documentNumber}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </>
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{indent.displayName || '—'}</div>
          <div className="text-sm text-steel">{indent.itemCode}</div>
        </div>
        <StatusCell indent={indent} />
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-canvas p-3 sm:grid-cols-3">
        <Detail label="PR date">{fmtDate(indent.date)}</Detail>
        <Detail label="Quantity">{indent.quantity != null ? `${indent.quantity} ${indent.units || ''}` : ''}</Detail>
        <Detail label="Order type">{indent.orderType}</Detail>
        <Detail label="NetSuite status">{indent.netsuiteStatus}</Detail>
        <Detail label="Last purchase price">{indent.lastPurchasePrice != null ? `₹ ${Number(indent.lastPurchasePrice).toLocaleString('en-IN')}` : ''}</Detail>
        <Detail label="Raised by">{indent.createdBy}</Detail>
        {!isManager && <Detail label="Expected receiving">{fmtDate(indent.expectedReceivingDate)}</Detail>}
        {indent.assignedAt && <Detail label="Assigned on">{fmtDateTime(indent.assignedAt)}</Detail>}
      </dl>

      <div className="space-y-4">
        {isManager && (
          <>
            <div>
              <label className="label" htmlFor="assignee">Responsible employee</label>
              <select id="assignee" className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {activeUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.name}{u.department ? ` (${u.department})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="expected">Expected receiving date</label>
              <input id="expected" type="date" className="field" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="label" htmlFor="actual">Actual receiving date</label>
          <div className="flex gap-2">
            <input id="actual" type="date" className="field" max={todayInput} value={actual} onChange={(e) => setActual(e.target.value)} />
            {!actual && <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setActual(todayInput)}>Received today</button>}
            {actual && <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setActual('')}>Clear</button>}
          </div>
          <p className="mt-1 text-xs text-steel">Entering this date marks the indent as completed. Clear it to reopen.</p>
        </div>
        <div>
          <label className="label" htmlFor="remarks">Remarks</label>
          <textarea id="remarks" rows={3} className="field" value={remarks} onChange={(e) => setRemarks(e.target.value)}
            placeholder="Vendor follow-up, partial receipt, GRN number…" />
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </Modal>
  );
}
