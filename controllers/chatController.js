const mongoose = require('mongoose');
const Message = require('../models/Message');
const JobApplication = require('../models/JobApplication');
const Teacher = require('../models/Teacher');
const { asyncHandler } = require('../middleware/errorMiddleware');

// @desc    Send message
// @route   POST /api/chat/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { applicationId, message, messageType = 'text', attachments } = req.body;

  console.log('Chat Controller - sendMessage called with:', {
    applicationId,
    message: message?.substring(0, 50) + '...',
    messageType,
    userId: req.user.id,
    userRole: req.user.role
  });

  // Validate applicationId
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    console.log('Chat Controller - Invalid applicationId:', applicationId);
    return res.status(400).json({
      success: false,
      message: 'Invalid application ID'
    });
  }

  const application = await JobApplication.findById(applicationId)
    .populate('job', 'title')
    .populate('school', 'user')
    .populate('applicant', 'email role');

  console.log('Chat Controller - Found application:', {
    applicationId,
    hasApplication: !!application,
    hasJob: !!application?.job,
    hasSchool: !!application?.school,
    hasApplicant: !!application?.applicant,
    schoolUserId: application?.school?.user,
    applicantId: application?.applicant?._id
  });

  if (!application) {
    console.log('Chat Controller - Application not found:', applicationId);
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  // Check if user is part of this application
  const isTeacher = application.applicant._id.toString() === req.user.id;
  const isSchool = application.school.user.toString() === req.user.id;

  console.log('Chat Controller - Authorization check:', {
    isTeacher,
    isSchool,
    applicantId: application.applicant._id.toString(),
    schoolUserId: application.school.user.toString(),
    currentUserId: req.user.id
  });

  if (!isTeacher && !isSchool) {
    console.log('Chat Controller - Authorization failed');
    return res.status(403).json({
      success: false,
      message: 'Not authorized to send message for this application'
    });
  }

  const receiverId = isTeacher ? application.school.user : application.applicant._id;

  console.log('Chat Controller - Creating message with:', {
    sender: req.user.id,
    receiver: receiverId,
    application: applicationId,
    message: message?.substring(0, 50) + '...',
    messageType
  });

  const newMessage = await Message.create({
    sender: req.user.id,
    receiver: receiverId,
    application: applicationId,
    message,
    messageType,
    attachments
  });

  console.log('Chat Controller - Message created successfully:', newMessage._id);

  // Emit real-time notification via Socket.IO with mobile popup support
  const io = req.app.get('io');
  if (io) {
    // Emit message notification (keeps existing format for compatibility)
    io.to(`user:${receiverId}`).emit('new_message', {
      type: 'new_message',
      message: {
        _id: newMessage._id,
        sender: req.user.id,
        receiver: receiverId,
        application: applicationId,
        message: newMessage.message,
        messageType: newMessage.messageType,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt
      },
      applicationId: applicationId,
      senderId: req.user.id,
      receiverId: receiverId,
      timestamp: new Date().toISOString()
    });

    // Also send as notification with popup support for mobile
    const { emitNotification } = require('../utils/notificationHelper');
    const Notification = require('../models/Notification');
    const Application = require('../models/JobApplication');
    
    try {
      // Get application details for notification
      const application = await Application.findById(applicationId)
        .populate('job', 'title')
        .populate('school', 'schoolName');
      
      const senderName = req.user.role === 'school' 
        ? (application?.school?.schoolName || 'School')
        : 'Teacher';
      
      // Create notification for new message
      const notification = await Notification.create({
        user: receiverId,
        type: 'message',
        title: `💬 New message from ${senderName}`,
        message: newMessage.message.substring(0, 100) + (newMessage.message.length > 100 ? '...' : ''),
        data: {
          applicationId: applicationId,
          senderId: req.user.id,
          jobTitle: application?.job?.title || 'Position',
          schoolName: application?.school?.schoolName || 'School'
        }
      });

      // Emit notification with popup for mobile and push notification
      await emitNotification(io, receiverId, {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        user: receiverId
      }, { 
        forcePopup: true, // Force popup for messages on mobile
        sendPush: true    // Send push notification (works even when app is closed)
      });
    } catch (notifError) {
      console.error('Error creating message notification:', notifError);
      // Continue even if notification creation fails
    }

    // Also emit to the sender for real-time updates
    io.to(`user:${req.user.id}`).emit('message_sent', {
      type: 'message_sent',
      message: {
        _id: newMessage._id,
        sender: req.user.id,
        receiver: receiverId,
        application: applicationId,
        message: newMessage.message,
        messageType: newMessage.messageType,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt
      },
      applicationId: applicationId,
      timestamp: new Date().toISOString()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    newMessage
  });
});

// @desc    Get messages for application
// @route   GET /api/chat/messages/:applicationId
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  console.log('Chat Controller - getMessages called with:', {
    applicationId,
    userId: req.user.id,
    userRole: req.user.role
  });

  const application = await JobApplication.findById(applicationId)
    .populate('job', 'title')
    .populate('school', 'user')
    .populate('applicant', 'email role');

  console.log('Chat Controller - Found application for messages:', {
    hasApplication: !!application,
    hasJob: !!application?.job,
    hasSchool: !!application?.school,
    hasApplicant: !!application?.applicant
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  // Check if user is part of this application
  const isTeacher = application.applicant._id.toString() === req.user.id;
  const isSchool = application.school.user.toString() === req.user.id;

  console.log('Chat Controller - Authorization check for messages:', {
    isTeacher,
    isSchool,
    applicantId: application.applicant._id.toString(),
    schoolUserId: application.school.user.toString(),
    currentUserId: req.user.id
  });

  if (!isTeacher && !isSchool) {
    console.log('Chat Controller - Authorization failed for messages');
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view messages for this application'
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  console.log('Chat Controller - Querying messages for application:', applicationId);

  const messages = await Message.find({
    application: applicationId,
    isDeleted: false
  })
    .populate('sender', 'email role')
    .populate('receiver', 'email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get teacher names for senders and receivers
  const teacherNames = {};
  const userIds = [...new Set([
    ...messages.map(msg => msg.sender?._id?.toString()).filter(Boolean),
    ...messages.map(msg => msg.receiver?._id?.toString()).filter(Boolean)
  ])];

  if (userIds.length > 0) {
    const teachers = await Teacher.find({ 
      user: { $in: userIds } 
    }).select('user personalInfo.firstName personalInfo.lastName');
    
    teachers.forEach(teacher => {
      const userId = teacher.user.toString();
      const firstName = teacher.personalInfo?.firstName || '';
      const lastName = teacher.personalInfo?.lastName || '';
      teacherNames[userId] = `${firstName} ${lastName}`.trim() || 'Teacher';
    });
  }

  // Add teacher names to messages
  const messagesWithNames = messages.map(message => {
    const senderId = message.sender?._id?.toString();
    const receiverId = message.receiver?._id?.toString();
    
    return {
      ...message.toObject(),
      sender: {
        ...message.sender?.toObject(),
        teacherName: teacherNames[senderId] || (message.sender?.role === 'teacher' ? 'Teacher' : 'School')
      },
      receiver: {
        ...message.receiver?.toObject(),
        teacherName: teacherNames[receiverId] || (message.receiver?.role === 'teacher' ? 'Teacher' : 'School')
      }
    };
  });

  console.log('Chat Controller - Found messages:', messagesWithNames.length);

  // Mark messages as read
  await Message.updateMany(
    {
      application: applicationId,
      receiver: req.user.id,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );

  console.log('Chat Controller - Returning messages successfully');

  res.json({
    success: true,
    messages: messagesWithNames.reverse() // Return in chronological order
  });
});

// @desc    Get user's conversations
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
  console.log('Chat Controller - getConversations called for user:', req.user.id);
  
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: req.user._id },
          { receiver: req.user._id }
        ],
        isDeleted: false
      }
    },
    {
      $lookup: {
        from: 'jobapplications',
        localField: 'application',
        foreignField: '_id',
        as: 'application'
      }
    },
    {
      $unwind: '$application'
    },
    {
      $lookup: {
        from: 'jobs',
        localField: 'application.job',
        foreignField: '_id',
        as: 'job'
      }
    },
    {
      $unwind: {
        path: '$job',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'schools',
        localField: 'application.school',
        foreignField: '_id',
        as: 'school'
      }
    },
    {
      $unwind: {
        path: '$school',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'application.applicant',
        foreignField: '_id',
        as: 'applicant'
      }
    },
    {
      $unwind: '$applicant'
    },
    {
      $lookup: {
        from: 'teachers',
        localField: 'applicant._id',
        foreignField: 'user',
        as: 'teacherProfile'
      }
    },
    {
      $unwind: {
        path: '$teacherProfile',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$application._id',
        applicationId: { $first: '$application._id' },
        jobTitle: { 
          $first: {
            $ifNull: ['$job.title', 'Position Not Specified']
          }
        },
        schoolName: { $first: '$school.schoolName' },
        teacherName: {
          $first: {
            $ifNull: [
              {
                $concat: [
                  { $ifNull: ['$teacherProfile.personalInfo.firstName', ''] },
                  ' ',
                  { $ifNull: ['$teacherProfile.personalInfo.lastName', ''] }
                ]
              },
              'Teacher'
            ]
          }
        },
        lastMessage: { $last: '$message' },
        lastMessageTime: { $last: '$createdAt' },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$receiver', req.user._id] }, { $eq: ['$isRead', false] }] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $sort: { lastMessageTime: -1 }
    }
  ]);

  console.log('Chat Controller - Found conversations:', conversations.length);
  console.log('Chat Controller - Conversations data:', conversations);
  
  // Debug conversations data
  conversations.forEach((conv, index) => {
    console.log(`Conversation ${index}:`, {
      applicationId: conv.applicationId,
      jobTitle: conv.jobTitle,
      teacherName: conv.teacherName,
      schoolName: conv.schoolName,
      schoolNameType: typeof conv.schoolName,
      schoolNameNull: conv.schoolName === null,
      schoolNameUndefined: conv.schoolName === undefined
    });
  });

  res.json({
    success: true,
    conversations
  });
});

// @desc    Mark message as read
// @route   PUT /api/chat/messages/:messageId/read
// @access  Private
const markMessageAsRead = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  if (message.receiver.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to mark this message as read'
    });
  }

  message.isRead = true;
  message.readAt = new Date();
  await message.save();

  res.json({
    success: true,
    message: 'Message marked as read'
  });
});

// @desc    Delete message
// @route   DELETE /api/chat/messages/:messageId
// @access  Private
const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  if (message.sender.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this message'
    });
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  await message.save();

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
});

// @desc    Get unread message count
// @route   GET /api/chat/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Message.countDocuments({
    receiver: req.user.id,
    isRead: false,
    isDeleted: false
  });

  res.json({
    success: true,
    unreadCount: count
  });
});

// @desc    Delete conversation
// @route   DELETE /api/chat/conversations/:applicationId
// @access  Private
const deleteConversation = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;

  console.log('Chat Controller - deleteConversation called with:', {
    applicationId,
    userId: req.user.id,
    userRole: req.user.role
  });

  // Validate applicationId
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid application ID'
    });
  }

  // Find the application
  const application = await JobApplication.findById(applicationId)
    .populate('school', 'user')
    .populate('applicant', 'email role');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  // Check if user is part of this application
  const isTeacher = application.applicant._id.toString() === req.user.id;
  const isSchool = application.school.user.toString() === req.user.id;

  if (!isTeacher && !isSchool) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this conversation'
    });
  }

  // Delete all messages for this application
  await Message.deleteMany({ application: applicationId });

  console.log('Chat Controller - Conversation deleted successfully:', applicationId);

  res.json({
    success: true,
    message: 'Conversation deleted successfully'
  });
});

module.exports = {
  sendMessage,
  getMessages,
  getConversations,
  markMessageAsRead,
  deleteMessage,
  getUnreadCount,
  deleteConversation
};








