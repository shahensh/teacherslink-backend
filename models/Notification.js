const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['shortlist', 'reject', 'interview', 'hired', 'job_posted', 'application_received', 'message', 'blog_published'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    // Additional data like job ID, school ID, etc.
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job'
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School'
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication'
    },
    schoolName: String,
    jobTitle: String,
    // Interview specific data
    interviewDetails: {
      date: String,
      time: String,
      type: {
        type: String,
        enum: ['video', 'phone', 'in-person']
      },
      location: String,
      notes: String,
      formattedDate: String,
      formattedTime: String
    },
    // Hiring specific data
    hiringDetails: {
      hiredAt: String,
      position: String,
      school: String
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

