/**
 * Helper utility for sending notifications with platform-specific formatting
 * Mobile apps receive popup-enabled notifications, websites receive standard notifications
 */

/**
 * Detect if a socket connection is from a mobile app
 * @param {Object} socket - Socket.IO socket object
 * @returns {boolean} - True if mobile app, false if website
 */
const isMobileApp = (socket) => {
  if (!socket) return false;
  
  // Check handshake headers for mobile app indicators
  const userAgent = socket.handshake?.headers?.['user-agent'] || '';
  const origin = socket.handshake?.headers?.origin || '';
  const referer = socket.handshake?.headers?.referer || '';
  
  // Check for Capacitor/Ionic app indicators
  const isCapacitorOrigin = origin.includes('capacitor://') || origin.includes('ionic://');
  const isCapacitorReferer = referer.includes('capacitor://') || referer.includes('ionic://');
  const isMobileUserAgent = userAgent.includes('com.teachershubb.app') || 
                             userAgent.includes('Capacitor') ||
                             userAgent.includes('Ionic');
  
  // Check socket metadata for platform flag
  const platform = socket.platform || socket.handshake?.query?.platform;
  const isMobilePlatform = platform === 'mobile' || platform === 'capacitor';
  
  return isCapacitorOrigin || isCapacitorReferer || isMobileUserAgent || isMobilePlatform;
};

/**
 * Format notification payload with platform-specific flags
 * @param {Object} notification - Notification object
 * @param {Object} socket - Socket.IO socket object (optional, for mobile detection)
 * @param {boolean} forcePopup - Force popup flag regardless of platform detection
 * @returns {Object} - Formatted notification payload
 */
const formatNotification = (notification, socket = null, forcePopup = false) => {
  const basePayload = {
    type: 'new_notification',
    notification: {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      isRead: notification.isRead || false,
      createdAt: notification.createdAt
    },
    userId: notification.user || notification.userId,
    timestamp: new Date().toISOString()
  };

  // Determine if this should show popup (mobile apps only)
  const shouldShowPopup = forcePopup || (socket && isMobileApp(socket));
  
  // Important notification types that should show popups on mobile
  const importantTypes = ['shortlist', 'reject', 'interview', 'hired', 'message'];
  const isImportant = importantTypes.includes(notification.type);
  
  // Add popup flag for mobile apps and important notifications
  if (shouldShowPopup && isImportant) {
    basePayload.showPopup = true;
    basePayload.popupPriority = 'high';
  }

  return basePayload;
};

/**
 * Emit notification to user with platform detection and push notifications
 * @param {Object} io - Socket.IO instance
 * @param {string} userId - User ID to send notification to
 * @param {Object} notification - Notification object
 * @param {Object} options - Additional options
 * @param {boolean} options.forcePopup - Force popup flag
 * @param {boolean} options.sendPush - Send push notification (default: true for important types)
 */
const emitNotification = async (io, userId, notification, options = {}) => {
  if (!io || !userId || !notification) {
    console.error('emitNotification: Missing required parameters');
    return;
  }

  // Get all sockets for this user to detect platform
  const userRoom = `user:${userId}`;
  const room = io.sockets.adapter.rooms.get(userRoom);
  
  // Check if any socket is mobile
  let hasMobileClient = false;
  if (room && room.size > 0) {
    room.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && (socket.platform === 'mobile' || isMobileApp(socket))) {
        hasMobileClient = true;
      }
    });
  }

  // Format notification with mobile detection
  // Create a mock socket object for formatting if mobile client detected
  const mockSocket = hasMobileClient ? { platform: 'mobile' } : null;
  const formatted = formatNotification(notification, mockSocket, options.forcePopup);

  // Emit to user's room (for in-app notifications)
  io.to(userRoom).emit('new_notification', formatted);
  
  // Send push notification (works even when app is closed)
  // Important notification types should always send push
  const importantTypes = ['shortlist', 'reject', 'interview', 'hired', 'message'];
  const shouldSendPush = options.sendPush !== false && (
    options.sendPush === true || 
    importantTypes.includes(notification.type) ||
    options.forcePopup
  );

  if (shouldSendPush) {
    try {
      const pushNotificationService = require('../services/pushNotificationService');
      
      const pushResult = await pushNotificationService.sendToUser(userId, {
        title: notification.title || 'Teachers Link',
        body: notification.message || '',
        type: notification.type || 'general',
        notificationId: notification._id?.toString() || ''
      }, {
        type: notification.type || 'general',
        notificationId: notification._id?.toString() || '',
        applicationId: notification.data?.applicationId || '',
        jobId: notification.data?.jobId || '',
        schoolId: notification.data?.schoolId || '',
        jobTitle: notification.data?.jobTitle || '',
        schoolName: notification.data?.schoolName || '',
        ...notification.data
      });
      
      // Only log success, silently handle failures
      if (pushResult.success) {
        console.log(`📲 Push notification sent to user ${userId}`, {
          type: notification.type,
          title: notification.title
        });
      } else {
        // Log silently for debugging, but don't show errors
        if (pushResult.reason !== 'no_devices' && pushResult.reason !== 'not_initialized') {
          console.log(`⚠️  Push notification skipped for user ${userId}: ${pushResult.reason || 'unknown'}`);
        }
      }
    } catch (pushError) {
      // Silently handle push notification errors - don't crash the app
      console.log(`⚠️  Push notification error for user ${userId}:`, pushError.message);
      // Don't fail the entire notification if push fails
    }
  }
  
  console.log(`📱 Notification sent to user ${userId}`, {
    type: notification.type,
    showPopup: formatted.showPopup || false,
    platform: hasMobileClient ? 'mobile' : 'web',
    connected: room ? room.size > 0 : false,
    pushSent: shouldSendPush
  });
};

module.exports = {
  isMobileApp,
  formatNotification,
  emitNotification
};

