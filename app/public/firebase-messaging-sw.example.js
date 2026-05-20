importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDAKgXjGJsUnD3c8FvMO6yWKAVvf2jjCcw",
  authDomain: "uni-event-f95e4.firebaseapp.com",
  databaseURL: "https://uni-event-f95e4-default-rtdb.firebaseio.com",
  projectId: "uni-event-f95e4",
  storageBucket: "uni-event-f95e4.firebasestorage.app",
  messagingSenderId: "404611555371",
  appId: "1:404611555371:web:52c0eac924e7124bfb8a6e",
  measurementId: "G-TWXYD69GJ3"
};
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/UniEvent.png',
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
