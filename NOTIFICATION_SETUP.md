# 📱 Mobile Notification Setup Guide

## Option 1: Telegram Bot (⚡ Easiest - 10 minutes)

### Benefits:
- ✅ No app installation needed
- ✅ Works on all devices
- ✅ Free forever
- ✅ Instant notifications
- ✅ No configuration in mobile app

### Setup Steps:

#### 1. Create Telegram Bot
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Choose a name (e.g., "Objednávky Alert")
4. Choose a username (e.g., "objednavky_alert_bot")
5. Copy the **bot token** (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

#### 2. Get Your Chat ID
1. Start a chat with your bot (click the link BotFather gives you)
2. Send any message to your bot
3. Visit this URL in your browser (replace YOUR_BOT_TOKEN):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Find your `chat_id` in the response (looks like: `123456789`)

#### 3. Configure Supabase
1. Go to Supabase Dashboard → Settings → Edge Functions
2. Add environment secrets:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```

#### 4. Deploy Edge Function
```bash
# Deploy the notification function
supabase functions deploy notify-telegram

# Set secrets
supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token_here
supabase secrets set TELEGRAM_CHAT_ID=your_chat_id_here
```

#### 5. Create Database Webhook
1. Go to Supabase Dashboard → Database → Webhooks
2. Click "Create a new webhook"
3. Configure:
   - **Name**: "Notify New Invoice"
   - **Table**: `invoices_received`
   - **Events**: INSERT
   - **Type**: HTTP Request
   - **HTTP Method**: POST
   - **URL**: `https://YOUR_PROJECT.supabase.co/functions/v1/notify-telegram`
   - **HTTP Headers**: 
     ```
     Authorization: Bearer YOUR_ANON_KEY
     Content-Type: application/json
     ```

#### 6. Test It!
Upload a new invoice and you should get a Telegram notification! 🎉

---

## Option 2: Web Push Notifications (📱 For PWA)

### Benefits:
- ✅ Native mobile notifications
- ✅ Works offline
- ✅ No third-party service needed

### Setup Steps:

#### 1. Install Dependencies
```bash
npm install web-push
```

#### 2. Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```

#### 3. Add Service Worker
Create `public/sw.js`:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

#### 4. Request Permission in App
Add to your React app:
```typescript
const requestNotificationPermission = async () => {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY',
      });
      
      // Save subscription to database
      await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: JSON.stringify(subscription),
        });
    }
  }
};
```

---

## Option 3: OneSignal (🚀 Professional - Free Tier)

### Benefits:
- ✅ Professional solution
- ✅ 10,000 notifications/month free
- ✅ Easy integration
- ✅ Analytics dashboard
- ✅ Multi-platform support

### Setup Steps:

#### 1. Create OneSignal Account
1. Go to https://onesignal.com
2. Create account and new app
3. Choose "Web Push" platform
4. Get your App ID and API Key

#### 2. Install OneSignal
```bash
npm install react-onesignal
```

#### 3. Initialize in Your App
```typescript
// src/lib/onesignal.ts
import OneSignal from 'react-onesignal';

export const initOneSignal = async () => {
  await OneSignal.init({
    appId: 'YOUR_ONESIGNAL_APP_ID',
    allowLocalhostAsSecureOrigin: true,
  });
  
  OneSignal.showSlidedownPrompt();
};
```

#### 4. Send Notification from Edge Function
```typescript
// In your Edge Function
const sendOneSignalNotification = async (message: string) => {
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`,
    },
    body: JSON.stringify({
      app_id: Deno.env.get('ONESIGNAL_APP_ID'),
      included_segments: ['All'],
      headings: { en: 'New Invoice' },
      contents: { en: message },
    }),
  });
  
  return response.json();
};
```

---

## Option 4: Firebase Cloud Messaging (FCM)

### Benefits:
- ✅ Free and unlimited
- ✅ Google's official solution
- ✅ Reliable and scalable
- ✅ Works with React Native

### Setup Steps:

#### 1. Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create new project
3. Add web app to project
4. Copy configuration

#### 2. Install Firebase
```bash
npm install firebase
```

#### 3. Initialize Firebase
```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestFCMToken = async () => {
  const token = await getToken(messaging, {
    vapidKey: 'YOUR_VAPID_KEY',
  });
  return token;
};
```

#### 4. Create Service Worker
Create `public/firebase-messaging-sw.js`:
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## 🎯 Recommendation

**For Quick Start (Today):**
→ **Use Telegram Bot** - Takes 10 minutes, works immediately

**For Production App:**
→ **Use OneSignal or FCM** - Professional solution with analytics

**For PWA:**
→ **Use Web Push** - Native browser notifications

---

## 📊 Feature Comparison

| Feature | Telegram | OneSignal | FCM | Web Push |
|---------|----------|-----------|-----|----------|
| Setup Time | 10 min | 30 min | 45 min | 60 min |
| Cost | Free | Free (10k/mo) | Free | Free |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| iOS Support | ✅ | ✅ | ✅ | ❌ |
| Android | ✅ | ✅ | ✅ | ✅ |
| Desktop | ✅ | ✅ | ✅ | ✅ |
| Offline | ❌ | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ | ❌ |

---

## 🔧 Testing

After setup, test your notifications:

```typescript
// Manual test from your app
const testNotification = async () => {
  const { data, error } = await supabase.functions.invoke('notify-telegram', {
    body: {
      type: 'INSERT',
      record: {
        table: 'invoices_received',
        invoice_number: 'TEST-001',
        supplier_id: 'test-supplier',
        total_amount: 1500.00,
        invoice_date: new Date().toISOString(),
        items_count: 5,
      },
    },
  });
  
  console.log('Test result:', data, error);
};
```

---

## 🛠️ Troubleshooting

### Telegram notifications not working?
1. Check bot token is correct
2. Verify chat ID is correct
3. Check Edge Function logs in Supabase
4. Make sure you sent a message to the bot first

### Push notifications not showing?
1. Check browser permissions
2. Verify service worker is registered
3. Test on HTTPS (required for push)
4. Check browser console for errors

### Need help?
Check the Supabase Edge Function logs:
```bash
supabase functions logs notify-telegram
```

