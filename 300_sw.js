// 1. ⚡ THE ZOMBIE KILLER: Forces the new SW to take over immediately
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// 2. ⚡ BULLETPROOF FIREBASE PARSER
self.addEventListener('push', function(event) {
    if (!event.data) return;

    let title = "💧 WOW DROPS";
    let body = "New Update Received!";

    try {
        const data = event.data.json();
        
        // Checks every possible folder Firebase might hide the text in
        if (data && data.notification) {
            title = data.notification.title || title;
            body = data.notification.body || body;
        } else if (data && data.data) { 
            title = data.data.title || title;
            body = data.data.body || body;
        } else if (data && data.title) {
            title = data.title;
            body = data.body;
        }
    } catch (e) {
        // If Firebase sends raw text instead of JSON, print the text
        body = event.data.text();
    }

    const options = {
        body: body,
        icon: 'https://wowdrops.github.io/wowLogo.jpg', // Optional: Add logo URL
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// 3. ⚡ TAP TO OPEN
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('https://wowdrops.github.io/351_portal.html')
    );
});