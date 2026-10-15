import { useState } from 'react';
import { StatusCell, StatusBadge } from './ui.jsx';
import { fmtDate } from '../utils/dates.js';
import { statusHint } from '../utils/status.js';

const PAGE = 100;

export default function IndentList({ rows, onOpen, selectable = false, selected, onToggle, onToggleAll, showAssignee = true }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = rows.slice(0, limit);
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected.has(r.id));

  if (!rows.length) return <div className="panel px-6 py-12 text-center text-sm text-steel">No indents match these filters.</div>;

  return (
    <div className="panel overflow-hidden">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas">
            <tr>
              {selectable && (
                <th className="th w-10">
                  <input type="checkbox" checked={allSelected} onChange={() => onToggleAll(!allSelected)} aria-label="Select all filtered indents" />
                </th>
              )}
              <th className="th">Indent</th>
              <th className="th">Item</th>
              <th className="th text-right">Qty</th>
              {showAssignee && <th className="th">Assigned to</th>}
              <th className="th">Expected</th>
              <th className="th">Received</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className={`cursor-pointer hover:bg-canvas ${selectable && selected.has(r.id) ? 'bg-teal-light/60' : ''}`}>
                {selectable && (
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.documentNumber} ${r.itemCode}`} />
                  </td>
                )}
                <td className="td whitespace-nowrap">
                  <div className="font-medium">{r.documentNumber}</div>
                  <div className="text-xs text-steel">{fmtDate(r.date)}{r.orderType ? `, ${r.orderType}` : ''}</div>
                </td>
                <td className="td min-w-[220px]">
                  <div>{r.displayName || '—'}</div>
                  <div className="text-xs text-steel">{r.itemCode}</div>
                </td>
                <td className="td whitespace-nowrap text-right tabular-nums">{r.quantity ?? '—'} <span className="text-xs text-steel">{r.units}</span></td>
                {showAssignee && <td className="td whitespace-nowrap">{r.assignedUserName || <span className="text-steel">Unassigned</span>}</td>}
                <td className="td whitespace-nowrap tabular-nums">{fmtDate(r.expectedReceivingDate)}</td>
                <td className="td whitespace-nowrap tabular-nums">{fmtDate(r.actualReceivingDate)}</td>
                <td className="td"><StatusCell indent={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-line md:hidden">
        {shown.map((r) => (
          <li key={r.id} className={`flex gap-3 px-4 py-3 ${selectable && selected.has(r.id) ? 'bg-teal-light/60' : ''}`}>
            {selectable && (
              <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.documentNumber} ${r.itemCode}`} />
            )}
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(r)}>
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{r.documentNumber}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-0.5 text-sm">{r.displayName || r.itemCode}</div>
              <div className="mt-1 text-xs text-steel">
                Qty {r.quantity ?? '—'} {r.units}. Expected {fmtDate(r.expectedReceivingDate)}
                {statusHint(r) ? ` (${statusHint(r).toLowerCase()})` : ''}
                {showAssignee ? `. ${r.assignedUserName || 'Unassigned'}` : ''}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {rows.length > limit && (
        <div className="border-t border-line px-4 py-3 text-center">
          <button className="btn-secondary" onClick={() => setLimit(limit + PAGE)}>
            Show more ({rows.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
