import { useEffect } from 'react';
import { STATUS_STYLE, statusHint } from '../utils/status.js';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-steel">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status] || ''}`}>
      {status}
    </span>
  );
}

export function StatusCell({ indent }) {
  const hint = statusHint(indent);
  return (
    <div>
      <StatusBadge status={indent.status} />
      {hint && <div className="mt-1 text-xs text-steel">{hint}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return <div className="py-16 text-center text-sm text-steel">{text}</div>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="panel px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mx-auto mt-2 max-w-md text-sm text-steel">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>;
}

/** A row of figures separated by hairlines (one panel, not a grid of cards). */
export function StatRow({ items }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => {
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag key={it.label} onClick={it.onClick}
            className={`bg-white px-4 py-4 text-left ${it.onClick ? 'hover:bg-canvas' : ''}`}>
            <div className={`text-2xl font-semibold tabular-nums ${it.tone || 'text-ink'}`}>{it.value}</div>
            <div className="mt-0.5 text-sm text-steel">{it.label}</div>
          </Tag>
        );
      })}
    </div>
  );
}
