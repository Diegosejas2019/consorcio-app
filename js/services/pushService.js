import { state } from '../core/state.js';
import { getOwnerSummary } from './ownerSummaryService.js';
import { toast } from '../ui/toast.js';

const FIREBASE_WEB_CONFIG = {
  apiKey:            'AIzaSyALo-U8cuAO3smKa-pD0u47TFpnFZYhRj0',
  authDomain:        'consorcio-app-15e78.firebaseapp.com',
  projectId:         'consorcio-app-15e78',
  storageBucket:     'consorcio-app-15e78.firebasestorage.app',
  messagingSenderId: '822644970609',
  appId:             '1:822644970609:web:29df8183cfbf20cf0937d0',
};
const FIREBASE_VAPID_KEY = 'BDzNAjBShFNHPbWyWCBTbv31_uqRfuVzyf27A-iCtQafSt5s-6HIZCFh1J7tp1P-T8WEZsxnYQoEZNKwAFygyxw';

let _messaging = null;

function _firebaseConfigured() {
  return !!FIREBASE_WEB_CONFIG.apiKey;
}

export async function setupPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (!_firebaseConfigured()) {
    console.warn('FCM: configurá FIREBASE_WEB_CONFIG en pushService.js para habilitar push notifications.');
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_WEB_CONFIG);
    _messaging = firebase.messaging();

    _messaging.onMessage((payload) => {
      const { title = '', body = '' } = payload.data || {};
      if (title || body) toast(`${title}${title && body ? ': ' : ''}${body}`, 'default');
    });

    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') return;

    const swReg = await navigator.serviceWorker.ready;
    const tokenOpts = { serviceWorkerRegistration: swReg };
    if (FIREBASE_VAPID_KEY) tokenOpts.vapidKey = FIREBASE_VAPID_KEY;
    const token = await _messaging.getToken(tokenOpts);
    if (token) {
      await api.auth.updateFcmToken(token);
    }
  } catch (err) {
    console.warn('Push notification setup failed:', err.message);
  }
}

export async function checkMonthlyReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().getDate();
  if (today > 5) return;
  try {
    const summary = await getOwnerSummary();
    const cfg     = summary.config;
    const month   = cfg.expenseMonthCode;
    const sentKey = `notif_sent_${state.user._id}_${month}`;
    if (localStorage.getItem(sentKey)) return;
    const paid = summary.payments.find(p => p.month === month && p.status === 'approved');
    if (!paid) {
      new Notification('GestionAr 🏘️', {
        body: `Recordatorio: las expensas de ${cfg.expenseMonth} vencen el día ${cfg.dueDayOfMonth}. ¡No olvides pagar!`,
        icon: 'icons/icon-192.png',
        tag:  `expensa-${month}`,
      });
      localStorage.setItem(sentKey, '1');
    }
  } catch { /* silencioso */ }
}
