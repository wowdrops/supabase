// ==========================================
// FIREBASE NOTIFICATIONS ENGINE
// ==========================================

// ⚠️ PASTE YOUR FIREBASE CONFIG HERE FROM STEP 1
const firebaseConfig = {
  apiKey: "AIzaSyADBmoxl5J9anzwjJgpDQEuxvhfZvl9Dhk",
  authDomain: "wowdropspush.firebaseapp.com",
  projectId: "wowdropspush",
  storageBucket: "wowdropspush.firebasestorage.app",
  messagingSenderId: "907964211557",
  appId: "1:907964211557:web:d53857dc437c403ad8818c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const VAPID_PUBLIC_KEY = "BKEhieRgAwDeodM7N8IVzeg9xlfmt06E4ynj9W-uWOs7Ad6RMNBykxAQ9TLY_Tz6NTc4flpHe8zsXaF_4cteLQs";

function triggerNotificationSetup() {
  if (!activeUserSession) return alert("Please login first to enable notifications.");

  const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

  if (isIos() && !isInStandaloneMode()) {
    document.getElementById('ios-install-prompt').classList.remove('hidden');
    return;
  }

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        subscribeUserToPush();
      } else {
        alert('Notification permission denied.');
      }
    });
  }
}

async function subscribeUserToPush() {
  try {
    // 1. Register the new Service Worker
    const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    
    // 2. Request the Token from Google
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      // 3. ⚡ NEW SUPABASE UPSERT (Replaces the old GAS call)
      const { error } = await window.supabase1
        .from('push_subscriptions')
        .upsert({ 
          cpn_no: activeUserSession.cpn, 
          subscription_json: { token: token } // Matches the JSON format the Edge Function expects!
        }, { onConflict: 'cpn_no' });

      if (error) {
        console.error("Database Error:", error);
        alert("Failed to save registration to database.");
        return;
      }

      alert("✅ Daily alerts successfully enabled on this device!");
    }

  } catch (error) {
    console.error('Failed to subscribe user: ', error);
  }
}

// --- PROACTIVE NOTIFICATION LOGIC ---
function checkNotificationStatus() {
  if ('Notification' in window && (Notification.permission === 'granted' || Notification.permission === 'denied')) {
      return; 
  }
  var skippedTime = localStorage.getItem('notification_skipped_time');
  if (skippedTime) {
    var daysElapsed = (new Date().getTime() - parseInt(skippedTime)) / (1000 * 60 * 60 * 24);
    if (daysElapsed < 2) return; 
  }
  setTimeout(function () { 
      var notifModal = document.getElementById('notification-modal');
      if (notifModal) notifModal.classList.remove('hidden'); 
  }, 500);
}

function skipNotificationCapture() {
  localStorage.setItem('notification_skipped_time', new Date().getTime().toString());
  document.getElementById('notification-modal').classList.add('hidden');
}

function acceptNotificationCapture() {
  document.getElementById('notification-modal').classList.add('hidden');
  triggerNotificationSetup(); 
}