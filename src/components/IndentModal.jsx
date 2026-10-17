import { useMemo, useState } from 'react';
import { Modal, StatusBadge, StageCell, ErrorText } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { updateIndent } from '../services/db.js';
import { enrich, poHint, materialHint, isPoRequired } from '../utils/status.js';
import { FIELD_LABELS } from '../utils/fields.js';
import { lineKey } from '../utils/excel.js';
import { fmtDate, fmtDateTime, toInputValue, fromInputValue, startOfDay } from '../utils/dates.js';

const NETSUITE = [
  ['documentNumber', 'text'], ['date', 'date'], ['orderType', 'text'], ['netsuiteStatus', 'text'],
  ['itemCode', 'text'], ['displayName', 'text'], ['quantity', 'number'], ['units', 'text'],
  ['lastPurchasePrice', 'number'], ['createdBy', 'text'],
  ['department', 'text'], ['location', 'text'], ['subsidiary', 'text'],
];
const TRACKING = [
  ['expectedPoDate', 'date'], ['poCreationDate', 'date'], ['poNumber', 'text'], ['poRemarks', 'textarea'],
  ['expectedReceivingDate', 'date'], ['actualReceivingDate', 'date'], ['receivingRemarks', 'textarea'], ['remarks', 'textarea'],
];
const FIELDS = [...NETSUITE, ...TRACKING];
const TYPE = Object.fromEntries(FIELDS);
const EMPLOYEE_EDITABLE = new Set(['expectedPoDate', 'poCreationDate', 'poNumber', 'poRemarks', 'actualReceivingDate', 'receivingRemarks', 'remarks']);

function toForm(i) {
  const f = {};
  for (const [k, t] of FIELDS) f[k] = t === 'date' ? toInputValue(i[k]) : i[k] == null ? '' : String(i[k]);
  f.poRequired = isPoRequired(i) ? 'yes' : 'no';
  f.assignee = i.assignedUserId || '';
  return f;
}

function Section({ title, badge, children }) {
  return (
    <section className="border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-steel">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Calc({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-steel">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default function IndentModal({ indent, users = [], existingIds, onClose }) {
  const { profile } = useAuth();
  const isManager = profile.role === 'manager';
  const initial = useMemo(() => toForm(indent), [indent.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const today = toInputValue(new Date());

  const canEdit = (k) => isManager || (EMPLOYEE_EDITABLE.has(k) && (k !== 'expectedPoDate' || !initial.expectedPoDate));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Turn the form into a list of changed fields (+ errors)
  const { changes, errors } = useMemo(() => {
    const ch = {};
    const er = [];
    for (const [k, t] of FIELDS) {
      if (f[k] === initial[k] || !canEdit(k)) continue;
      if (t === 'date') ch[k] = fromInputValue(f[k]);
      else if (t === 'number') {
        const n = f[k].trim() === '' ? null : Number(f[k].replace(/,/g, ''));
        if (Number.isNaN(n)) er.push(`${FIELD_LABELS[k]} must be a number.`);
        else ch[k] = n;
      } else ch[k] = f[k].trim();
    }
    if (isManager && f.poRequired !== initial.poRequired) ch.poRequired = f.poRequired === 'yes';
    if (isManager && f.assignee !== initial.assignee) {
      const u = users.find((x) => x.uid === f.assignee);
      ch.assignedUserId = f.assignee || null;
      ch.assignedUserName = u?.name || null;
      ch.assignedAt = f.assignee ? new Date() : null;
    }
    return { changes: ch, errors: er };
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const merged = { ...indent, ...changes };
  const preview = enrich(merged);

  function validate() {
    const e = [...errors];
    const endToday = startOfDay(new Date());
    if (!String(merged.documentNumber || '').trim()) e.push('Document Number cannot be empty.');
    if (!String(merged.itemCode || '').trim() && !String(merged.displayName || '').trim()) e.push('Enter an Item Code or an Item Description.');
    if (isManager && !f.date) e.push('Date cannot be empty.');
    if (fromInputValue(f.poCreationDate) > endToday) e.push('PO Creation Date cannot be in the future.');
    if (fromInputValue(f.actualReceivingDate) > endToday) e.push('Actual Receiving Date cannot be in the future.');
    if (f.poRequired === 'yes') {
      if (f.poCreationDate && !f.poNumber.trim()) e.push('Enter the PO Number together with the PO Creation Date.');
      if (!f.poCreationDate && f.poNumber.trim()) e.push('Enter the PO Creation Date together with the PO Number.');
      if (f.actualReceivingDate && !f.poCreationDate) e.push('Stage 1 is not finished: enter the PO Creation Date and PO Number before the receiving date.');
    }
    const identityChanged = 'documentNumber' in changes || 'itemCode' in changes || (!merged.itemCode && 'displayName' in changes);
    const newId = identityChanged ? lineKey(merged.documentNumber, merged.itemCode, merged.displayName) : indent.id;
    if (newId !== indent.id && existingIds?.has(newId)) e.push('Another indent line with this Document Number and Item Code already exists.');
    return e;
  }

  async function save() {
    const e = validate();
    if (e.length) return setErr(e.join(' '));
    if (!Object.keys(changes).length) return onClose();
    setBusy(true);
    setErr('');
    try {
      await updateIndent(indent, changes, profile);
      onClose();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  const input = (k, extra = {}) => {
    const t = TYPE[k];
    const disabled = !canEdit(k);
    const cls = `field ${disabled ? 'bg-canvas text-steel' : ''}`;
    if (t === 'textarea') return <textarea id={k} rows={2} className={cls} value={f[k]} onChange={set(k)} disabled={disabled} />;
    return <input id={k} type={t === 'number' ? 'text' : t} inputMode={t === 'number' ? 'decimal' : undefined} className={cls} value={f[k]} onChange={set(k)} disabled={disabled} {...extra} />;
  };
  const field = (k, { span, today: todayBtn, note, ...extra } = {}) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={k}>{FIELD_LABELS[k]}</label>
      {todayBtn && canEdit(k) ? (
        <div className="flex gap-2">
          {input(k, extra)}
          {f[k]
            ? <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setF({ ...f, [k]: '' })}>Clear</button>
            : <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setF({ ...f, [k]: today })}>Today</button>}
        </div>
      ) : input(k, extra)}
      {note && <p className="mt-1 text-xs text-steel">{note}</p>}
    </div>
  );

  const activeUsers = users.filter((u) => u.active || u.uid === indent.assignedUserId);
  const dash = (v) => (v == null || v === '' ? '—' : v);

  return (
    <Modal wide title={isManager ? `Edit indent ${indent.documentNumber}` : indent.documentNumber} onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </>
      }>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-medium">{indent.displayName || '—'}</div>
            <div className="text-sm text-steel">{indent.itemCode || 'No item code'}{indent.importBatchId ? `. Batch ${indent.importBatchId}` : ''}</div>
          </div>
          <StatusBadge status={preview.overallStatus} />
        </div>

        <Section title="Indent details (NetSuite)">
          {isManager ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {NETSUITE.map(([k]) => <div key={k}>{field(k)}</div>)}
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Calc label="PR date">{fmtDate(indent.date)}</Calc>
              <Calc label="Quantity">{indent.quantity != null ? `${indent.quantity} ${indent.units || ''}` : '—'}</Calc>
              <Calc label="Order type">{dash(indent.orderType)}</Calc>
              <Calc label="NetSuite status">{dash(indent.netsuiteStatus)}</Calc>
              <Calc label="Last purchase price">{indent.lastPurchasePrice != null ? `₹ ${Number(indent.lastPurchasePrice).toLocaleString('en-IN')}` : '—'}</Calc>
              <Calc label="Raised by">{dash(indent.createdBy)}</Calc>
              <Calc label="Department">{dash(indent.department)}</Calc>
              <Calc label="Location">{dash(indent.location)}</Calc>
            </dl>
          )}
        </Section>

        <Section title="Assignment">
          {isManager ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="assignee">Assigned Employee</label>
                <select id="assignee" className="field" value={f.assignee} onChange={set('assignee')}>
                  <option value="">Unassigned</option>
                  {activeUsers.map((u) => <option key={u.uid} value={u.uid}>{u.name}{u.department ? ` (${u.department})` : ''}</option>)}
                </select>
              </div>
              {indent.assignedAt && <div className="self-end pb-2 text-sm text-steel">Assigned on {fmtDateTime(indent.assignedAt)}</div>}
            </div>
          ) : (
            <p className="text-sm">{indent.assignedUserName}{indent.assignedAt ? `, since ${fmtDate(indent.assignedAt)}` : ''}</p>
          )}
        </Section>

        <Section title="Stage 1: Purchase order" badge={<StageCell status={preview.poStatus} hint={poHint(preview)} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="poRequired">{FIELD_LABELS.poRequired}</label>
              {isManager ? (
                <select id="poRequired" className="field" value={f.poRequired} onChange={set('poRequired')}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : <p className="py-2 text-sm">{f.poRequired === 'yes' ? 'Yes' : 'No'}</p>}
            </div>
            {f.poRequired === 'yes' ? (
              <>
                {field('expectedPoDate', { note: !isManager && !initial.expectedPoDate ? 'You can set this once. After that only the manager can change it.' : undefined })}
                {field('poCreationDate', { today: true, max: today })}
                {field('poNumber')}
                {field('poRemarks', { span: true })}
              </>
            ) : (
              <p className="self-end pb-2 text-sm text-steel">No purchase order needed. Tracking goes straight to material receiving.</p>
            )}
          </div>
        </Section>

        <Section title="Stage 2: Material receiving" badge={<StageCell status={preview.materialStatus} hint={materialHint(preview)} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('expectedReceivingDate')}
            {field('actualReceivingDate', { today: true, max: today, note: 'Entering this date completes the indent. Clear it to reopen.' })}
            {field('receivingRemarks', { span: true })}
          </div>
        </Section>

        <Section title="General">
          {field('remarks')}
        </Section>

        <Section title="Calculated automatically">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-canvas p-3 sm:grid-cols-4">
            <Calc label="PO Status"><StatusBadge status={preview.poStatus} /></Calc>
            <Calc label="PO Delay Days">{dash(preview.poDelayDays)}</Calc>
            <Calc label="PO Performance"><StatusBadge status={preview.poPerformance} /></Calc>
            <Calc label="Overall Status"><StatusBadge status={preview.overallStatus} /></Calc>
            <Calc label="Material Status"><StatusBadge status={preview.materialStatus} /></Calc>
            <Calc label="Material Delay Days">{dash(preview.materialDelayDays)}</Calc>
            <Calc label="Material Performance"><StatusBadge status={preview.materialPerformance} /></Calc>
            <Calc label="Performance Status"><StatusBadge status={preview.performanceStatus} /></Calc>
          </dl>
          <p className="mt-2 text-xs text-steel">These update as you type and cannot be edited by hand. Delay days: positive = late, zero or negative = on time.</p>
        </Section>

        <ErrorText>{err}</ErrorText>
      </div>
    </Modal>
  );
}
