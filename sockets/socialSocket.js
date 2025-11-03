const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Share = require('../models/Share');
const JobApplication = require('../models/JobApplication');
const Teacher = require('../models/Teacher');
const School = require('../models/School');

// Socket.io middleware for authentication
const authenticateSocket = async (socket, next) => {
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
    next(new Error('Authentication error: Invalid token'));
  }
};

// Real-time social features
const setupSocialSocket = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected to social socket`);

    // Join user to their personal room for notifications
    socket.join(`user:${socket.userId}`);

    // Join user to general feed room
    socket.join('feed');

    // Handle post creation
    socket.on('create_post', async (data) => {
      try {
        // Emit to all users in feed
        socket.to('feed').emit('new_post', {
          type: 'post_created',
          data: data,
          timestamp: new Date().toISOString()
        });

        // Emit to post author
        socket.emit('post_created', {
          success: true,
          message: 'Post created successfully',
          post: data
        });
      } catch (error) {
        socket.emit('post_error', {
          success: false,
          message: 'Failed to create post',
          error: error.message
        });
      }
    });


    // Handle post comments
    socket.on('comment_post', async (data) => {
      try {
        const { postId, comment } = data;

        // Emit to all users viewing this post
        socket.to(`post:${postId}`).emit('post_commented', {
          type: 'post_commented',
          postId,
          comment,
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

        // Emit to post author if they're online
        const post = await Post.findById(postId).populate('author');
        if (post && post.author._id.toString() !== socket.userId) {
          socket.to(`user:${post.author._id}`).emit('notification', {
            type: 'post_commented',
            message: `${socket.userRole} commented on your post`,
            postId,
            commentId: comment._id,
            userId: socket.userId,
            timestamp: new Date().toISOString()
          });
        }

        socket.emit('comment_success', {
          success: true,
          postId,
          comment
        });
      } catch (error) {
        socket.emit('comment_error', {
          success: false,
          message: 'Failed to add comment',
          error: error.message
        });
      }
    });

    // Handle post shares
    socket.on('share_post', async (data) => {
      try {
        const { postId, share } = data;

        // Emit to all users in feed
        socket.to('feed').emit('post_shared', {
          type: 'post_shared',
          postId,
          share,
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

        // Emit to post author if they're online
        const post = await Post.findById(postId).populate('author');
        if (post && post.author._id.toString() !== socket.userId) {
          socket.to(`user:${post.author._id}`).emit('notification', {
            type: 'post_shared',
            message: `${socket.userRole} shared your post`,
            postId,
            shareId: share._id,
            userId: socket.userId,
            timestamp: new Date().toISOString()
          });
        }

        socket.emit('share_success', {
          success: true,
          postId,
          share
        });
      } catch (error) {
        socket.emit('share_error', {
          success: false,
          message: 'Failed to share post',
          error: error.message
        });
      }
    });

    // Handle joining post room (for real-time updates on specific posts)
    socket.on('join_post', (postId) => {
      socket.join(`post:${postId}`);
      console.log(`User ${socket.userId} joined post room: ${postId}`);
    });

    // Handle leaving post room
    socket.on('leave_post', (postId) => {
      socket.leave(`post:${postId}`);
      console.log(`User ${socket.userId} left post room: ${postId}`);
    });

    // Handle profile updates
    socket.on('profile_updated', (data) => {
      // Emit to user's connections
      socket.to(`user:${socket.userId}`).emit('profile_update', {
        type: 'profile_updated',
        userId: socket.userId,
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Handle image uploads
    socket.on('image_uploaded', (data) => {
      const { type, url, userId } = data; // type: 'profile' or 'cover'
      
      // Emit to user's connections
      socket.to(`user:${userId}`).emit('image_uploaded', {
        type: 'image_uploaded',
        imageType: type,
        url,
        userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle connection requests
    socket.on('connection_request', async (data) => {
      try {
        const { recipientId } = data;

        // Emit to recipient
        socket.to(`user:${recipientId}`).emit('notification', {
          type: 'connection_request',
          message: `${socket.userRole} wants to connect with you`,
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

        socket.emit('connection_request_sent', {
          success: true,
          message: 'Connection request sent'
        });
      } catch (error) {
        socket.emit('connection_error', {
          success: false,
          message: 'Failed to send connection request',
          error: error.message
        });
      }
    });

    // Handle typing indicators for comments
    socket.on('typing_comment', (data) => {
      const { postId, isTyping } = data;
      socket.to(`post:${postId}`).emit('user_typing_comment', {
        userId: socket.userId,
        postId,
        isTyping,
        timestamp: new Date().toISOString()
      });
    });

    // Handle online status
    socket.on('set_online_status', (status) => {
      socket.to(`user:${socket.userId}`).emit('user_status_changed', {
        userId: socket.userId,
        status,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnect
    // Application-related events
    socket.on('join_school_applications', async () => {
      try {
        if (socket.userRole !== 'school') {
          return socket.emit('error', { message: 'Unauthorized access' });
        }
        
        const school = await School.findOne({ user: socket.userId });
        if (school) {
          socket.join(`school_applications:${school._id}`);
          console.log(`School ${school._id} joined applications room`);
        }
      } catch (error) {
        console.error('Error joining school applications room:', error);
        socket.emit('error', { message: 'Failed to join applications room' });
      }
    });

    socket.on('application_status_updated', async (data) => {
      try {
        const { applicationId, newStatus } = data;
        
        // Find the application and update status
        const application = await JobApplication.findById(applicationId)
          .populate('school', 'schoolName')
          .populate('applicant', 'email role');
        
        if (!application) {
          return socket.emit('error', { message: 'Application not found' });
        }
        
        // Update the application status
        application.status = newStatus;
        application.reviewedAt = new Date();
        application.reviewedBy = socket.userId;
        await application.save();
        
        // Emit to the school's applications room
        socket.to(`school_applications:${application.school._id}`).emit('application_updated', {
          applicationId,
          status: newStatus,
          reviewedAt: application.reviewedAt,
          applicant: application.applicant.email
        });
        
        // Also emit to the applicant if they're online
        socket.to(`user:${application.applicant._id}`).emit('application_status_changed', {
          applicationId,
          status: newStatus,
          school: application.school.schoolName,
          reviewedAt: application.reviewedAt
        });
        
        console.log(`Application ${applicationId} status updated to ${newStatus}`);
      } catch (error) {
        console.error('Error updating application status:', error);
        socket.emit('error', { message: 'Failed to update application status' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from social socket`);
      
      // Notify connections about offline status
      socket.to(`user:${socket.userId}`).emit('user_status_changed', {
        userId: socket.userId,
        status: 'offline',
        timestamp: new Date().toISOString()
      });
    });
  });

  return io;
};

module.exports = setupSocialSocket;
