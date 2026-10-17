import { useState } from 'react';
import { StageCell, StatusBadge } from './ui.jsx';
import { fmtDate } from '../utils/dates.js';
import { poHint, materialHint } from '../utils/status.js';

const PAGE = 100;

export default function IndentList({ rows, onOpen, onDelete, selectable = false, selected, onToggle, onToggleAll, showAssignee = true }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = rows.slice(0, limit);
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected.has(r.id));
  const stop = (e) => e.stopPropagation();

  if (!rows.length) return <div className="panel px-6 py-12 text-center text-sm text-steel">No indents match these filters.</div>;

  return (
    <div className="panel overflow-hidden">
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
              {showAssignee && <th className="th">Assigned to</th>}
              <th className="th">Stage 1: PO</th>
              <th className="th">Stage 2: Material</th>
              <th className="th">Overall</th>
              {onDelete && <th className="th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className={`cursor-pointer hover:bg-canvas ${selectable && selected.has(r.id) ? 'bg-teal-light/60' : ''}`}>
                {selectable && (
                  <td className="td" onClick={stop}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.documentNumber} ${r.itemCode}`} />
                  </td>
                )}
                <td className="td whitespace-nowrap">
                  <div className="font-medium">{r.documentNumber}</div>
                  <div className="text-xs text-steel">{[fmtDate(r.date), r.orderType, r.department].filter(Boolean).join(', ')}</div>
                </td>
                <td className="td min-w-[200px]">
                  <div>{r.displayName || '—'}</div>
                  <div className="text-xs text-steel">{r.itemCode ? `${r.itemCode}. ` : ''}Qty {r.quantity ?? '—'} {r.units}</div>
                </td>
                {showAssignee && <td className="td whitespace-nowrap">{r.assignedUserName || <span className="text-steel">Unassigned</span>}</td>}
                <td className="td"><StageCell status={r.poStatus} hint={poHint(r)} /></td>
                <td className="td"><StageCell status={r.materialStatus} hint={materialHint(r)} /></td>
                <td className="td"><StatusBadge status={r.overallStatus} /></td>
                {onDelete && (
                  <td className="td whitespace-nowrap text-right" onClick={stop}>
                    <button className="btn-ghost px-2 py-1" onClick={() => onOpen(r)}>Edit</button>
                    <button className="btn-ghost px-2 py-1 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => onDelete(r)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {shown.map((r) => (
          <li key={r.id} className={`flex gap-3 px-4 py-3 ${selectable && selected.has(r.id) ? 'bg-teal-light/60' : ''}`}>
            {selectable && (
              <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.documentNumber} ${r.itemCode}`} />
            )}
            <div className="min-w-0 flex-1">
              <button className="w-full text-left" onClick={() => onOpen(r)}>
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate font-medium">{r.documentNumber}</span>
                  <StatusBadge status={r.overallStatus} />
                </div>
                <div className="mt-0.5 text-sm">{r.displayName || r.itemCode}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  <div><div className="mb-0.5 text-[11px] text-steel">PO</div><StageCell status={r.poStatus} hint={poHint(r)} /></div>
                  <div><div className="mb-0.5 text-[11px] text-steel">Material</div><StageCell status={r.materialStatus} hint={materialHint(r)} /></div>
                </div>
                {showAssignee && <div className="mt-1 text-xs text-steel">{r.assignedUserName || 'Unassigned'}</div>}
              </button>
              {onDelete && (
                <div className="mt-2 flex gap-2">
                  <button className="btn-secondary px-3 py-1" onClick={() => onOpen(r)}>Edit</button>
                  <button className="btn-secondary px-3 py-1 text-red-700" onClick={() => onDelete(r)}>Delete</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {rows.length > limit && (
        <div className="border-t border-line px-4 py-3 text-center">
          <button className="btn-secondary" onClick={() => setLimit(limit + PAGE)}>Show more ({rows.length - limit} remaining)</button>
        </div>
      )}
    </div>
  );
}
