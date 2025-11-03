# Push Notifications Setup Guide

This guide explains how to set up Firebase Cloud Messaging (FCM) push notifications for the mobile app.

## Overview

Push notifications allow users to receive notifications on their mobile devices even when the app is closed, similar to WhatsApp notifications.

## Features

- ✅ Works when app is closed
- ✅ Works when app is in background
- ✅ Works when app is open (in-app notifications)
- ✅ Automatic token management
- ✅ Platform detection (Android/iOS)
- ✅ High priority notifications for important events

## Backend Setup

### 1. Install Dependencies

Already installed: `firebase-admin`

### 2. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file (service account key)

### 3. Configure Environment Variables

Add to your `.env` file:

**Option 1: Full Service Account JSON (Recommended)**
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**Option 2: Individual Credentials**
```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\n-----END PRIVATE KEY-----\n"
```

### 4. Restart Backend Server

```bash
npm run dev
# or
npm start
```

You should see: `✅ Firebase Admin SDK initialized for push notifications`

## Mobile App Setup

### 1. Register Device Token

When user logs in or app starts, register the FCM token:

```javascript
// After getting FCM token from Capacitor
import { PushNotifications } from '@capacitor/push-notifications';

// Get FCM token
const result = await PushNotifications.register();
const fcmToken = result.token;

// Register with backend
await fetch('http://your-backend-url/api/devices/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    fcmToken: fcmToken,
    platform: 'android', // or 'ios'
    deviceId: 'unique-device-id', // optional
    appVersion: '1.0.0' // optional
  })
});
```

### 2. Handle Push Notifications

```javascript
// Listen for push notifications
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('Push notification received:', notification);
  // Show notification to user
});

// Handle notification tap
PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
  console.log('Push notification action performed:', action);
  // Navigate to relevant screen
  const data = action.notification.data;
  if (data.type === 'message') {
    // Navigate to chat
  } else if (data.type === 'shortlist') {
    // Navigate to applications
  }
});
```

### 3. Unregister on Logout

```javascript
// When user logs out
await fetch('http://your-backend-url/api/devices/remove', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    fcmToken: fcmToken
  })
});
```

## API Endpoints

### Register Device Token
```
POST /api/devices/register
Authorization: Bearer <token>
Body: {
  fcmToken: string,
  platform: 'android' | 'ios' | 'web',
  deviceId?: string,
  appVersion?: string
}
```

### Remove Device Token
```
DELETE /api/devices/remove
Authorization: Bearer <token>
Body: {
  fcmToken: string
}
```

### Get User's Devices
```
GET /api/devices
Authorization: Bearer <token>
```

## How It Works

1. **User logs in** → Mobile app gets FCM token → Registers with backend
2. **Event occurs** (e.g., school shortlists teacher) → Backend creates notification
3. **Backend sends**:
   - Socket.IO notification (for in-app notifications)
   - Push notification via FCM (works even when app closed)
4. **User receives** notification on device
5. **User taps notification** → App opens to relevant screen

## Notification Types That Send Push

- `shortlist` - When teacher is shortlisted
- `reject` - When application is rejected
- `interview` - When interview is scheduled
- `hired` - When teacher is hired
- `message` - When new message is received

## Testing

1. Register device token via API
2. Trigger an event (e.g., shortlist an application)
3. Check backend logs for: `📲 Push notification sent to user`
4. Verify notification appears on device (even when app is closed)

## Troubleshooting

### Push notifications not working

1. **Check Firebase initialization**
   - Look for: `✅ Firebase Admin SDK initialized`
   - If not: Check environment variables

2. **Check device token registration**
   - Call `GET /api/devices` to see registered devices
   - Verify token is active

3. **Check backend logs**
   - Look for errors in push notification service
   - Check if tokens are invalid (will be auto-deactivated)

4. **Firebase Project Configuration**
   - Ensure Firebase project has FCM enabled
   - For Android: Add `google-services.json` to mobile app
   - For iOS: Add `GoogleService-Info.plist` to mobile app

### Invalid Token Errors

Invalid tokens are automatically deactivated. This happens when:
- User uninstalls app
- User logs out and clears app data
- Token expires

The backend handles this automatically.

## Security Notes

- Device tokens are stored securely in database
- Tokens are scoped to user accounts
- Invalid tokens are automatically removed
- Tokens are deactivated on logout

## Production Checklist

- [ ] Firebase project created
- [ ] Service account key configured
- [ ] Environment variables set
- [ ] Backend restarted
- [ ] Mobile app configured with Firebase
- [ ] `google-services.json` added to Android app
- [ ] `GoogleService-Info.plist` added to iOS app
- [ ] Push notification permissions requested
- [ ] Test notifications working
- [ ] Invalid token cleanup working

