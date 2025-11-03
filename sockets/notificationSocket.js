const jwt = require('jsonwebtoken');
const User = require('../models/User');

const setupNotificationSocket = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      
      // Detect platform (mobile app vs website)
      const { isMobileApp } = require('../utils/notificationHelper');
      socket.platform = isMobileApp(socket) ? 'mobile' : 'web';
      
      next();
    } catch (error) {
      console.log('Socket authentication error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔔 User ${socket.userId} connected to notifications`);

    // Join user-specific room for notifications
    socket.join(`user:${socket.userId}`);

    // Handle notification events
    socket.on('mark_notification_read', async (data) => {
      try {
        // This would typically update the database
        // For now, we'll just acknowledge the event
        socket.emit('notification_marked_read', { 
          success: true, 
          notificationId: data.notificationId 
        });
      } catch (error) {
        socket.emit('notification_error', { 
          error: 'Failed to mark notification as read' 
        });
      }
    });

    socket.on('get_unread_count', async () => {
      try {
        // This would typically fetch from database
        // For now, we'll emit a placeholder
        socket.emit('unread_count', { count: 0 });
      } catch (error) {
        socket.emit('notification_error', { 
          error: 'Failed to get unread count' 
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔔 User ${socket.userId} disconnected from notifications`);
    });
  });

  return io;
};

module.exports = setupNotificationSocket;
