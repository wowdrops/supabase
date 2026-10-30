importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 1. Initialize Firebase in the background
const firebaseConfig = {
  apiKey: "AIzaSyADBmoxl5J9anzwjJgpDQEuxvhfZvl9Dhk",
  authDomain: "wowdropspush.firebaseapp.com",
  projectId: "wowdropspush",
  storageBucket: "wowdropspush.firebasestorage.app",
  messagingSenderId: "907964211557",
  appId: "1:907964211557:web:d53857dc437c403ad8818c"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 2. Handle notifications while the app is in the background
messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  
  // Safely extract the dynamic URL we packed in the Edge Function
  const dynamicUrl = payload.fcmOptions?.link || "https://wowdrops.github.io/351_portal.html";

  const notificationOptions = {
    body: payload.notification.body,
    icon: 'wowLogo.jpg', 
    data: dynamicUrl // Store the URL here so the click event can read it
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 3. Handle the tap/click event to route the user
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Read the dynamic URL from the notification data, fallback to portal if missing
  const urlToOpen = event.notification.data || 'https://wowdrops.github.io/351_portal.html';
  
  event.waitUntil(clients.openWindow(urlToOpen));
});