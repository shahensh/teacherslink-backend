const admin = require('firebase-admin');
const Device = require('../models/Device');

class PushNotificationService {
  constructor() {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      try {
        // Check if service account JSON is provided
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
          // Alternative: Individual environment variables
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
          });
        } else {
          console.warn('⚠️  Firebase Admin SDK not initialized. Push notifications will be disabled.');
          console.warn('   Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID in .env');
          this.initialized = false;
          return;
        }
        this.initialized = true;
        console.log('✅ Firebase Admin SDK initialized for push notifications');
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
        this.initialized = false;
      }
    } else {
      this.initialized = true;
    }
  }

  /**
   * Send push notification to a user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   * @param {Object} data - Additional data payload
   * @returns {Promise<Object>}
   */
  async sendToUser(userId, notification, data = {}) {
    if (!this.initialized) {
      console.warn('Push notifications not initialized, skipping...');
      return { success: false, reason: 'not_initialized' };
    }

    try {
      // Get all active device tokens for this user
      const devices = await Device.find({
        user: userId,
        isActive: true
      });

      if (devices.length === 0) {
        console.log(`No active devices found for user ${userId}`);
        return { success: false, reason: 'no_devices' };
      }

      const tokens = devices.map(device => device.fcmToken);
      const results = await this.sendToTokens(tokens, notification, data);

      // Remove invalid tokens
      if (results.invalidTokens && results.invalidTokens.length > 0) {
        await Device.updateMany(
          { fcmToken: { $in: results.invalidTokens } },
          { isActive: false }
        );
        console.log(`Deactivated ${results.invalidTokens.length} invalid tokens`);
      }

      return results;
    } catch (error) {
      console.error('Error sending push notification to user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to specific FCM tokens
   * @param {string|string[]} tokens - FCM token(s)
   * @param {Object} notification - Notification payload
   * @param {Object} data - Data payload
   * @returns {Promise<Object>}
   */
  async sendToTokens(tokens, notification, data = {}) {
    if (!this.initialized) {
      return { success: false, reason: 'not_initialized' };
    }

    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    
    if (tokenArray.length === 0) {
      return { success: false, reason: 'no_tokens' };
    }

    try {
      const message = {
        notification: {
          title: notification.title || 'Teachers Link',
          body: notification.body || notification.message || '',
        },
        data: {
          ...data,
          type: notification.type || data.type || 'general',
          notificationId: notification.notificationId || data.notificationId || '',
          // Convert all data values to strings (FCM requirement)
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {})
        },
        // Android-specific options
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'teacherslink_notifications',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            icon: 'ic_notification',
            color: '#FF6B35' // Your app's primary color
          }
        },
        // iOS-specific options
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true
            }
          }
        },
        // Web push options
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png'
          }
        }
      };

      // Send to multiple tokens (batch)
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokenArray,
        ...message
      });

      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          if (resp.error && (
            resp.error.code === 'messaging/invalid-registration-token' ||
            resp.error.code === 'messaging/registration-token-not-registered'
          )) {
            invalidTokens.push(tokenArray[idx]);
          }
          console.error(`Failed to send to token ${tokenArray[idx].substring(0, 20)}...:`, resp.error);
        }
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens: invalidTokens
      };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification with high priority (for important notifications)
   */
  async sendHighPriorityNotification(userId, title, body, data = {}) {
    return this.sendToUser(userId, {
      title,
      body,
      type: data.type || 'important'
    }, {
      ...data,
      priority: 'high'
    });
  }
}

// Export singleton instance
module.exports = new PushNotificationService();

