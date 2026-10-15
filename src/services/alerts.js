import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, firebaseConfig, VAPID_KEY } from '../firebase.js';
import { ALERT_TYPE, alertMessage } from '../utils/status.js';
import { dateKey } from '../utils/dates.js';
import { createNotification, saveFcmToken } from './db.js';

/** Same id pattern as functions/index.js, so the app and the scheduler never create the same alert twice. */
export const alertId = (indentId, type, expected) => `${indentId}_${type}_${dateKey(expected)}`;

/**
 * Runs whenever an employee has the app open. Creates the Due Soon / Urgent / Overdue
 * alerts for their own indents. This keeps alerts working on the free Firebase plan,
 * where the scheduled Cloud Function is not available.
 */
export async function syncMyAlerts(uid, indents, existingIds, inFlight) {
  const created = [];
  for (const ind of indents) {
    if (ind.assignedUserId !== uid) continue;
    const type = ALERT_TYPE[ind.status];
    if (!type) continue;
    const id = alertId(ind.id, type, ind.expectedReceivingDate);
    if (existingIds.has(id) || inFlight.has(id)) continue;
    inFlight.add(id);
    const message = alertMessage(ind, type);
    try {
      await createNotification(id, { userId: uid, indentId: ind.id, documentNumber: ind.documentNumber, type, message, source: 'app' });
      created.push(message);
    } catch {
      /* already created by the scheduler or another tab */
    }
  }
  return created;
}

async function registerWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || '', projectId: firebaseConfig.projectId || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '', appId: firebaseConfig.appId || '',
  });
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js?${params}`);
}

export async function showBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon.svg` });
    else new Notification(title, { body });
  } catch {
    /* some mobile browsers only allow notifications from an installed app */
  }
}

/** Asks permission, registers the service worker and (if a VAPID key is set) saves the FCM push token. */
export async function enableAlerts(uid) {
  if (!('Notification' in window)) throw new Error('This browser does not support notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in the browser site settings, then try again.');
  const reg = await registerWorker();
  if (!VAPID_KEY || !reg || !(await isSupported())) return 'browser';
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (token) await saveFcmToken(uid, token);
  return token ? 'push' : 'browser';
}

/** Shows push messages that arrive while the app is open in the foreground. */
export async function listenForegroundPush() {
  if (!VAPID_KEY || !(await isSupported())) return () => {};
  return onMessage(getMessaging(app), (payload) => {
    const n = payload.notification || {};
    showBrowserNotification(n.title || 'Indent alert', n.body || '');
  });
}
