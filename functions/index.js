/**
 * Daily alert job (needs the Firebase Blaze plan).
 * Runs every morning at 08:00 IST:
 *  1. Recalculates trackingStatus for every open indent.
 *  2. Creates Due Soon / Urgent / Overdue notifications (once per stage).
 *  3. Sends push notifications to each employee's registered devices.
 *  4. Sends managers a short overdue summary.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const TZ_OFFSET_MIN = 330; // India Standard Time
const DAY = 86400000;
const APP_URL = process.env.APP_URL || '';

const shifted = (date) => new Date(date.getTime() + TZ_OFFSET_MIN * 60000);
const dayNumber = (date) => Math.floor(shifted(date).getTime() / DAY);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (date) => { const d = shifted(date); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; };
const fmt = (date) => { const d = shifted(date); return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Same rules as src/utils/status.js
function statusFor(ind, todayN) {
  const exp = ind.expectedReceivingDate ? ind.expectedReceivingDate.toDate() : null;
  const act = ind.actualReceivingDate ? ind.actualReceivingDate.toDate() : null;
  if (act) {
    if (!exp) return 'Completed';
    return dayNumber(act) <= dayNumber(exp) ? 'Completed - On Time' : 'Completed - Late';
  }
  if (!exp) return 'Not Scheduled';
  const left = dayNumber(exp) - todayN;
  if (left < 0) return 'Overdue';
  if (left <= 3) return 'Urgent';
  if (left <= 7) return 'Due Soon';
  return 'Pending';
}
const ALERT = { 'Due Soon': 'due_soon', Urgent: 'urgent', Overdue: 'overdue' };

function message(ind, type, left) {
  const what = `${ind.documentNumber} (${ind.displayName || ind.itemCode})`;
  const due = fmt(ind.expectedReceivingDate.toDate());
  if (type === 'overdue') return `OVERDUE: ${what} was expected on ${due} and is not received yet.`;
  if (type === 'urgent') return `URGENT: ${what} is due ${left === 0 ? 'today' : `in ${plural(left, 'day')}`} (${due}).`;
  return `Reminder: ${what} is due in ${plural(left, 'day')} (${due}).`;
}

async function sendPush(uid, msgs) {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  const tokens = snap.get('fcmTokens') || [];
  if (!tokens.length) return;
  const title = msgs.length === 1 ? 'Indent alert' : `${msgs.length} indent alerts`;
  const body = msgs.slice(0, 3).join('\n') + (msgs.length > 3 ? `\n+${msgs.length - 3} more` : '');
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    ...(APP_URL ? { webpush: { fcmOptions: { link: APP_URL } } } : {}),
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
  });
  if (dead.length) await ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) });
}

exports.dailyIndentAlerts = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Kolkata', region: 'asia-south1' },
  async () => {
    const now = new Date();
    const todayN = dayNumber(now);
    const snap = await db.collection('indents').where('actualReceivingDate', '==', null).get();

    const writer = db.bulkWriter();
    writer.onWriteError((err) => { logger.warn('Write skipped', err.message); return false; });

    const candidates = [];
    let overdueTotal = 0;
    for (const d of snap.docs) {
      const ind = d.data();
      const status = statusFor(ind, todayN);
      if (status !== ind.trackingStatus) writer.update(d.ref, { trackingStatus: status });
      if (status === 'Overdue') overdueTotal++;
      const type = ALERT[status];
      if (type && ind.assignedUserId) {
        const exp = ind.expectedReceivingDate.toDate();
        candidates.push({ ref: db.doc(`notifications/${d.id}_${type}_${dateKey(exp)}`), ind, id: d.id, type, left: dayNumber(exp) - todayN });
      }
    }

    const perUser = new Map();
    const push = (uid, msg) => { if (!perUser.has(uid)) perUser.set(uid, []); perUser.get(uid).push(msg); };

    for (const group of chunk(candidates, 300)) {
      const existing = await db.getAll(...group.map((c) => c.ref));
      existing.forEach((s, i) => {
        if (s.exists) return; // this stage was already alerted
        const c = group[i];
        const msg = message(c.ind, c.type, c.left);
        writer.create(c.ref, {
          userId: c.ind.assignedUserId, indentId: c.id, documentNumber: c.ind.documentNumber || '',
          type: c.type, message: msg, read: false, source: 'scheduler',
          notificationDate: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
        });
        push(c.ind.assignedUserId, msg);
      });
    }

    if (overdueTotal > 0) {
      const managers = await db.collection('users').where('role', '==', 'manager').where('active', '==', true).get();
      const msg = `Daily summary: ${plural(overdueTotal, 'indent item')} overdue today.`;
      managers.forEach((m) => {
        writer.set(db.doc(`notifications/digest_${m.id}_${dateKey(now)}`), {
          userId: m.id, indentId: null, type: 'digest', message: msg, read: false, source: 'scheduler',
          notificationDate: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
        });
        push(m.id, msg);
      });
    }

    await writer.close();
    for (const [uid, msgs] of perUser) {
      try { await sendPush(uid, msgs); } catch (e) { logger.error(`Push failed for ${uid}`, e); }
    }
    logger.info(`Checked ${snap.size} open indents, ${candidates.length} in alert window, pushed to ${perUser.size} users.`);
  }
);
