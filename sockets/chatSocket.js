const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');

const setupChatSocket = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('Authentication error'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      
      // Detect platform (mobile app vs website)
      const { isMobileApp } = require('../utils/notificationHelper');
      socket.platform = isMobileApp(socket) ? 'mobile' : 'web';
      
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected to chat`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Join application-specific rooms
    socket.on('join_application', async (applicationId) => {
      try {
        const application = await JobApplication.findById(applicationId)
          .populate('job', 'school')
          .populate('applicant', 'email role');

        if (!application) {
          socket.emit('error', { message: 'Application not found' });
          return;
        }

        // Check if user is part of this application
        const isTeacher = application.applicant.toString() === socket.userId;
        const isSchool = application.job.school.user.toString() === socket.userId;

        if (!isTeacher && !isSchool) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        socket.join(`application_${applicationId}`);
        socket.emit('joined_application', { applicationId });

        // Send recent messages
        const messages = await Message.find({
          application: applicationId,
          isDeleted: false
        })
          .populate('sender', 'email role')
          .sort({ createdAt: -1 })
          .limit(50);

        socket.emit('recent_messages', messages.reverse());
      } catch (error) {
        socket.emit('error', { message: 'Failed to join application' });
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { applicationId, message, messageType = 'text', attachments } = data;

        const application = await JobApplication.findById(applicationId)
          .populate('job', 'school')
          .populate('applicant', 'email role');

        if (!application) {
          socket.emit('error', { message: 'Application not found' });
          return;
        }

        // Check if user is part of this application
        const isTeacher = application.applicant.toString() === socket.userId;
        const isSchool = application.job.school.user.toString() === socket.userId;

        if (!isTeacher && !isSchool) {
          socket.emit('error', { message: 'Not authorized to send message' });
          return;
        }

        const receiverId = isTeacher ? application.job.school.user : application.applicant;

        // Create message in database
        const newMessage = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          application: applicationId,
          message,
          messageType,
          attachments
        });

        // Populate sender info
        await newMessage.populate('sender', 'email role');

        // Add to application communication
        application.communication.push({
          sender: socket.userId,
          message,
          timestamp: new Date(),
          isRead: false
        });

        await application.save();

        // Emit message to all users in the application room
        io.to(`application_${applicationId}`).emit('new_message', newMessage);

        // Get updated message count for this application
        const messageCount = await Message.countDocuments({
          application: applicationId,
          isDeleted: false
        });

        // Emit application update event with message count (for real-time ATS updates)
        const School = require('../models/School');
        const schoolProfile = await School.findOne({ user: application.job.school.user });
        if (schoolProfile) {
          io.to(`school_applications:${schoolProfile._id}`).emit('application_updated', {
            applicationId,
            messageCount,
            lastMessageAt: newMessage.createdAt
          });
          console.log(`Emitted message count update to school room: school_applications:${schoolProfile._id}`, {
            applicationId,
            messageCount
          });
        }

        // Send notification to receiver if they're not in the room
        const receiverSocket = await findUserSocket(receiverId);
        if (receiverSocket) {
          receiverSocket.emit('message_notification', {
            applicationId,
            sender: socket.userId,
            message: message.substring(0, 100),
            timestamp: newMessage.createdAt
          });
        }

        socket.emit('message_sent', { messageId: newMessage._id });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { applicationId } = data;
      socket.to(`application_${applicationId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { applicationId } = data;
      socket.to(`application_${applicationId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: false
      });
    });

    // Handle message read status
    socket.on('mark_messages_read', async (data) => {
      try {
        const { applicationId } = data;

        await Message.updateMany(
          {
            application: applicationId,
            receiver: socket.userId,
            isRead: false
          },
          {
            isRead: true,
            readAt: new Date()
          }
        );

        // Notify sender that messages were read
        socket.to(`application_${applicationId}`).emit('messages_read', {
          userId: socket.userId,
          applicationId
        });
      } catch (error) {
        console.error('Mark messages read error:', error);
      }
    });

    // Handle online status
    socket.on('set_online_status', (isOnline) => {
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        isOnline
      });
    });

    // Job-related events
    socket.on('join_job_feed', () => {
      socket.join('job_feed');
      console.log(`User ${socket.userId} joined job feed`);
    });

    socket.on('leave_job_feed', () => {
      socket.leave('job_feed');
      console.log(`User ${socket.userId} left job feed`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from chat`);
      
      // Notify others that user went offline
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        isOnline: false
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Helper function to find user socket
  const findUserSocket = async (userId) => {
    const sockets = await io.fetchSockets();
    return sockets.find(socket => socket.userId === userId);
  };

  // Job event emitters
  const emitJobCreated = async (job) => {
    try {
      const populatedJob = await Job.findById(job._id)
        .populate('school', 'schoolName user')
        .populate('school.user', 'email');
      
      io.to('job_feed').emit('new_job_posted', populatedJob);
      console.log(`Emitted new job: ${populatedJob.title}`);
    } catch (error) {
      console.error('Error emitting job created:', error);
    }
  };

  const emitJobUpdated = async (job) => {
    try {
      const populatedJob = await Job.findById(job._id)
        .populate('school', 'schoolName user')
        .populate('school.user', 'email');
      
      io.to('job_feed').emit('job_updated', populatedJob);
      console.log(`Emitted job updated: ${populatedJob.title}`);
    } catch (error) {
      console.error('Error emitting job updated:', error);
    }
  };

  const emitJobDeleted = (jobId) => {
    io.to('job_feed').emit('job_deleted', jobId);
    console.log(`Emitted job deleted: ${jobId}`);
  };

  // Make emitters available globally
  global.jobSocketEmitters = {
    emitJobCreated,
    emitJobUpdated,
    emitJobDeleted
  };

  return io;
};

module.exports = setupChatSocket;





