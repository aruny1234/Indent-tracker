import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { PageHeader, EmptyState, ErrorText } from '../components/ui.jsx';
import { markRead, markAllRead } from '../services/db.js';
import { enableAlerts } from '../services/alerts.js';
import { fmtDateTime, toDate } from '../utils/dates.js';

const tone = (type = '') =>
  type.endsWith('overdue') ? 'border-l-red-500'
  : type.endsWith('due_today') || type === 'urgent' ? 'border-l-orange-400'
  : type.endsWith('due_soon') ? 'border-l-amber-300'
  : 'border-l-teal';

export default function Alerts() {
  const { profile } = useAuth();
  const { notifications, indents } = useData();
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const list = useMemo(
    () => {
      const live = new Set(indents.map((i) => i.id));
      // hide alerts for indents that were deleted or reassigned away
      return notifications.filter((n) => !n.indentId || live.has(n.indentId)).sort((a, b) => (toDate(b.createdAt)?.getTime() || Date.now()) - (toDate(a.createdAt)?.getTime() || Date.now()));
    },
    [notifications, indents]
  );
  const unreadIds = list.filter((n) => !n.read).map((n) => n.id);

  async function turnOn() {
    setErr('');
    try {
      const mode = await enableAlerts(profile.uid);
      setPerm('granted');
      setMsg(mode === 'push' ? 'Alerts are on. This device will get push notifications, even when the app is closed.' : 'Alerts are on. You will see notifications while the app is open.');
    } catch (e) {
      setErr(e.message);
      setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    }
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Reminders for both stages: when the expected PO date or receiving date is within 7 days, due today, and overdue."
        actions={
          <>
            {perm !== 'granted' && perm !== 'unsupported' && <button className="btn-primary" onClick={turnOn}>Turn on alerts on this device</button>}
            {unreadIds.length > 0 && <button className="btn-secondary" onClick={() => markAllRead(unreadIds)}>Mark all as read</button>}
          </>
        }
      />
      <div className="mb-4 space-y-2">
        <ErrorText>{err}</ErrorText>
        {msg && <p className="rounded-md bg-teal-light px-3 py-2 text-sm text-teal-dark">{msg}</p>}
      </div>
      {!list.length ? (
        <EmptyState title="No alerts" text="Alerts appear here when an assigned indent is due within 7 days or is overdue." />
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full rounded-md border border-l-4 border-line bg-white px-4 py-3 text-left ${tone(n.type)} ${n.read ? 'opacity-60' : ''}`}
              >
                <div className={`text-sm ${n.read ? '' : 'font-medium'}`}>{n.message}</div>
                <div className="mt-1 text-xs text-steel">{fmtDateTime(n.createdAt)}{!n.read ? '. Tap to mark as read' : ''}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
