const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'interviewed', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  coverLetter: {
    type: String,
    required: [true, 'Cover letter is required']
  },
  resume: String, // URL to uploaded resume
  additionalDocuments: [String], // URLs to additional documents
  applicationDate: {
    type: Date,
    default: Date.now
  },
  reviewDate: Date,
  reviewNotes: String,
  interviewSchedule: {
    scheduledDate: Date,
    interviewType: {
      type: String,
      enum: ['Phone', 'Video', 'In-person', 'Panel']
    },
    location: String,
    meetingLink: String,
    interviewer: String,
    notes: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled']
    }
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    strengths: [String],
    areasForImprovement: [String]
  },
  offerDetails: {
    offeredSalary: Number,
    startDate: Date,
    benefits: [String],
    offerExpiry: Date,
    offerAccepted: Boolean,
    offerAcceptedDate: Date
  },
  communication: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure unique application per teacher per job
applicationSchema.index({ job: 1, teacher: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);








