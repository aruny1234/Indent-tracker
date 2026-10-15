/* Service worker for Firebase Cloud Messaging (background push).
   The Firebase config is passed as URL parameters when the app registers this file,
   so nothing needs editing here. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;
if (params.get('apiKey')) {
  firebase.initializeApp({
    apiKey: params.get('apiKey'),
    projectId: params.get('projectId'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
  });
  // Messages sent with a "notification" payload are displayed automatically when the app is in the background.
  firebase.messaging();
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.registration.scope));
});
