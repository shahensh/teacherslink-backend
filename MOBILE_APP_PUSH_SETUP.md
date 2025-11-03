# Mobile App Push Notifications Setup Guide

This guide explains how to integrate push notifications in your Capacitor mobile app frontend.

## 📦 Step 1: Install Required Packages

### Install Capacitor Push Notifications Plugin

```bash
npm install @capacitor/push-notifications
npx cap sync
```

### For Ionic/React Apps

```bash
npm install @capacitor/push-notifications
npx cap sync
```

## 🔧 Step 2: Configure Capacitor

### Android Configuration

1. **Add to `android/app/src/main/AndroidManifest.xml`:**

```xml
<!-- Add permissions -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<!-- Add FCM default notification channel -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="teacherslink_notifications" />
```

2. **Add Firebase config file:**
   - Download `google-services.json` from Firebase Console
   - Place it in `android/app/` directory

### iOS Configuration

1. **Add Push Notifications capability:**
   - Open `ios/App/App.xcworkspace` in Xcode
   - Go to **Signing & Capabilities**
   - Click **+ Capability**
   - Add **Push Notifications**

2. **Add Firebase config file:**
   - Download `GoogleService-Info.plist` from Firebase Console
   - Add it to your iOS project in Xcode

3. **Update `ios/App/App/Info.plist`:**
```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

## 📱 Step 3: Create Push Notification Service

Create a file: `src/services/pushNotificationService.ts` (or `.js`)

```typescript
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

class PushNotificationService {
  private fcmToken: string | null = null;
  private backendUrl: string;

  constructor() {
    // Your backend URL
    this.backendUrl = process.env.REACT_APP_API_URL || 'http://10.123.14.134:5001';
  }

  /**
   * Initialize push notifications
   * Call this when user logs in
   */
  async initialize(userToken: string) {
    // Check if running on native platform
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        this.fcmToken = token.value;
        
        // Register token with backend
        await this.registerTokenWithBackend(token.value, userToken);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      // Listen for push notifications when app is OPEN
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        
        // Show notification to user (optional - native notification will show automatically)
        // You can show a custom in-app notification here
        this.handleNotificationReceived(notification);
      });

      // Listen for notification tap (when app is in background or closed)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action performed:', action);
        
        // Navigate to relevant screen based on notification data
        this.handleNotificationTap(action);
      });

    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(fcmToken: string, userToken: string) {
    try {
      const platform = Capacitor.getPlatform(); // 'android' or 'ios'
      const deviceId = await this.getDeviceId();

      const response = await fetch(`${this.backendUrl}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          fcmToken: fcmToken,
          platform: platform,
          deviceId: deviceId,
          appVersion: '1.0.0' // Replace with your app version
        })
      });

      if (response.ok) {
        console.log('✅ Device token registered successfully');
      } else {
        console.error('❌ Failed to register device token:', await response.text());
      }
    } catch (error) {
      console.error('Error registering token with backend:', error);
    }
  }

  /**
   * Get unique device ID
   */
  private async getDeviceId(): Promise<string> {
    // You can use @capacitor/device plugin for this
    // For now, generate a simple ID
    const { Device } = await import('@capacitor/device');
    const deviceInfo = await Device.getId();
    return deviceInfo.identifier || `device_${Date.now()}`;
  }

  /**
   * Handle notification received (app is open)
   */
  private handleNotificationReceived(notification: any) {
    const data = notification.data || {};
    const title = notification.title || 'Teachers Link';
    const body = notification.body || '';

    // Show custom in-app notification if needed
    // You can use a toast library or custom notification component
    console.log('Notification received:', { title, body, data });

    // Emit event for your app to handle
    // Example: EventEmitter.emit('notification-received', { title, body, data });
  }

  /**
   * Handle notification tap (navigate to relevant screen)
   */
  private handleNotificationTap(action: any) {
    const notification = action.notification;
    const data = notification.data || {};

    console.log('Notification tapped:', data);

    // Navigate based on notification type
    switch (data.type) {
      case 'shortlist':
        // Navigate to applications screen or specific application
        // Example: router.push(`/applications/${data.applicationId}`);
        break;
      
      case 'reject':
        // Navigate to applications screen
        // Example: router.push('/applications');
        break;
      
      case 'interview':
        // Navigate to interview details or applications
        // Example: router.push(`/applications/${data.applicationId}`);
        break;
      
      case 'hired':
        // Navigate to applications or success screen
        // Example: router.push(`/applications/${data.applicationId}`);
        break;
      
      case 'message':
        // Navigate to chat/messages
        // Example: router.push(`/chat/${data.applicationId}`);
        break;
      
      default:
        // Navigate to notifications screen
        // Example: router.push('/notifications');
        break;
    }
  }

  /**
   * Unregister token (call on logout)
   */
  async unregister(userToken: string) {
    if (!this.fcmToken) {
      return;
    }

    try {
      await fetch(`${this.backendUrl}/api/devices/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          fcmToken: this.fcmToken
        })
      });

      // Remove all listeners
      await PushNotifications.removeAllListeners();
      
      this.fcmToken = null;
      console.log('✅ Device token unregistered');
    } catch (error) {
      console.error('Error unregistering token:', error);
    }
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.fcmToken;
  }
}

// Export singleton instance
export default new PushNotificationService();

```

## 🔌 Step 4: Integrate in Your App

### In Your Login/Auth Component

```typescript
import pushNotificationService from './services/pushNotificationService';

// After successful login
const handleLogin = async (userToken: string) => {
  // ... your login logic ...
  
  // Initialize push notifications
  await pushNotificationService.initialize(userToken);
};
```

### In Your Logout Function

```typescript
import pushNotificationService from './services/pushNotificationService';

const handleLogout = async (userToken: string) => {
  // Unregister push notifications
  await pushNotificationService.unregister(userToken);
  
  // ... your logout logic ...
};
```

### In Your App Root/Initialization

```typescript
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth'; // Your auth hook
import pushNotificationService from './services/pushNotificationService';

function App() {
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Initialize push notifications when user is logged in
      pushNotificationService.initialize(token);
    }

    // Cleanup on unmount
    return () => {
      if (token) {
        pushNotificationService.unregister(token);
      }
    };
  }, [user, token]);

  return (
    // Your app content
  );
}
```

## 📝 Step 5: Update Capacitor Configuration

### For Android

Add to `android/app/build.gradle`:

```gradle
dependencies {
    // ... existing dependencies ...
    implementation platform('com.google.firebase:firebase-bom:32.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

### For iOS

No additional configuration needed if you've added Push Notifications capability.

## 🧪 Step 6: Testing

### Test Device Registration

1. **Login to app** → Check console for: `Push registration success, token: ...`
2. **Check backend logs** → Should see device registered
3. **Call API** → `GET /api/devices` to verify token is stored

### Test Push Notifications

1. **Trigger a notification** (e.g., shortlist an application)
2. **App closed** → Notification should appear on device
3. **App in background** → Notification should appear
4. **App open** → Notification should appear and trigger listener

### Test Notification Tap

1. **Send notification**
2. **Tap notification** → App should open and navigate to relevant screen

## 🔍 Step 7: Troubleshooting

### Notifications not appearing

1. **Check permissions:**
   ```typescript
   const status = await PushNotifications.checkPermissions();
   console.log('Permission status:', status);
   ```

2. **Check token registration:**
   - Verify token is being sent to backend
   - Check backend logs for registration success

3. **Check Firebase configuration:**
   - Verify `google-services.json` is in correct location
   - Verify `GoogleService-Info.plist` is added to iOS project

### Token not registering

1. **Check backend URL** is correct
2. **Check authentication token** is valid
3. **Check network** connectivity
4. **Check backend logs** for errors

### iOS-specific issues

1. **Verify Push Notifications capability** is added in Xcode
2. **Check APNs certificate** is configured in Firebase
3. **Test on real device** (push notifications don't work on simulator)

## 📋 Checklist

- [ ] Installed `@capacitor/push-notifications`
- [ ] Added Android permissions to `AndroidManifest.xml`
- [ ] Added `google-services.json` to Android project
- [ ] Added Push Notifications capability in Xcode (iOS)
- [ ] Added `GoogleService-Info.plist` to iOS project
- [ ] Created push notification service
- [ ] Integrated in login flow
- [ ] Integrated in logout flow
- [ ] Tested token registration
- [ ] Tested push notifications (app closed)
- [ ] Tested push notifications (app open)
- [ ] Tested notification tap navigation

## 🔐 Security Notes

- **Never commit** `google-services.json` or `GoogleService-Info.plist` to public repos
- **Add to `.gitignore`** if they contain sensitive data
- **Use environment variables** for backend URL
- **Store user token securely** (use secure storage)

## 📚 Additional Resources

- [Capacitor Push Notifications Docs](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Android Push Setup](https://firebase.google.com/docs/cloud-messaging/android/client)
- [iOS Push Setup](https://firebase.google.com/docs/cloud-messaging/ios/client)

