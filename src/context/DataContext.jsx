import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { watchIndents, watchUsers, watchNotifications } from '../services/db.js';
import { syncMyAlerts, showBrowserNotification, listenForegroundPush } from '../services/alerts.js';
import { enrich } from '../utils/status.js';
import { startOfDay } from '../utils/dates.js';

const DataCtx = createContext(null);

const friendly = (e) =>
  e?.code === 'permission-denied'
    ? 'Firestore refused access. Check that firestore.rules has been published and that your user profile has the correct role.'
    : e?.message || String(e);

export function DataProvider({ children }) {
  const { profile } = useAuth();
  const isManager = profile.role === 'manager';
  const [raw, setRaw] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [error, setError] = useState('');
  const [today, setToday] = useState(() => startOfDay(new Date()));
  const inFlight = useRef(new Set());

  // Re-evaluate statuses when the date changes (app left open overnight).
  useEffect(() => {
    const t = setInterval(() => {
      const d = startOfDay(new Date());
      setToday((prev) => (prev.getTime() === d.getTime() ? prev : d));
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(
    () => watchIndents(profile.uid, isManager, (r) => { setRaw(r); setLoaded(true); }, (e) => { setError(friendly(e)); setLoaded(true); }),
    [profile.uid, isManager]
  );
  useEffect(() => (isManager ? watchUsers(setUsers, (e) => setError(friendly(e))) : undefined), [isManager]);
  useEffect(
    () => watchNotifications(profile.uid, (n) => { setNotifications(n); setNotesLoaded(true); }, (e) => setError(friendly(e))),
    [profile.uid]
  );
  useEffect(() => {
    let off = () => {};
    listenForegroundPush().then((fn) => (off = fn)).catch(() => {});
    return () => off();
  }, []);

  const indents = useMemo(
    () => raw.map((i) => enrich(i, today)),
    [raw, today]
  );

  // Employees: create in-app alerts for their own indents.
  useEffect(() => {
    if (isManager || !loaded || !notesLoaded) return;
    const existing = new Set(notifications.map((n) => n.id));
    syncMyAlerts(profile.uid, indents, existing, inFlight.current).then((created) => {
      if (created.length === 1) showBrowserNotification('Indent alert', created[0]);
      else if (created.length > 1) showBrowserNotification(`${created.length} indent alerts`, created.slice(0, 3).join('\n'));
    });
  }, [isManager, loaded, notesLoaded, indents, notifications, profile.uid]);

  const unread = notifications.filter((n) => !n.read).length;
  const value = { indents, users, notifications, unread, loaded, error, today, isManager };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);
