const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema({
  // Application Information
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: false // Allow general inquiries without specific job
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Applicant reference is required']
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School reference is required']
  },
  
  // Application Details
  coverLetter: {
    type: String,
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
  },
  resume: {
    url: String,
    filename: String,
    uploadedAt: Date
  },
  portfolio: {
    url: String,
    filename: String,
    uploadedAt: Date
  },
  additionalDocuments: [{
    name: String,
    url: String,
    filename: String,
    uploadedAt: Date
  }],
  
  // Application Status
  status: {
    type: String,
    enum: [
      'submitted', 'under-review', 'shortlisted', 'interview-scheduled',
      'interviewed', 'accepted', 'hired', 'rejected', 'withdrawn'
    ],
    default: 'submitted'
  },
  
  // Interview Information
  interview: {
    scheduledDate: Date,
    interviewType: {
      type: String,
      enum: ['phone', 'video', 'in-person', 'panel']
    },
    location: String,
    notes: String,
    feedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Communication
  messages: {
    type: [{
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
    default: []
  },
  
  // Application Questions & Answers
  customQuestions: [{
    question: String,
    answer: String
  }],
  
  // Availability
  availability: {
    startDate: Date,
    noticePeriod: String,
    preferredSchedule: String,
    flexibility: String
  },
  
  // Salary Expectations
  salaryExpectation: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    negotiable: {
      type: Boolean,
      default: true
    }
  },
  
  // Internal Notes
  internalNotes: String,
  rejectionReason: String,
  
  // Metadata
  appliedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
JobApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
JobApplicationSchema.index({ school: 1, status: 1 });
JobApplicationSchema.index({ applicant: 1, status: 1 });
JobApplicationSchema.index({ appliedAt: -1 });
JobApplicationSchema.index({ status: 1 });

// Virtual for days since application
JobApplicationSchema.virtual('daysSinceApplication').get(function() {
  const now = new Date();
  const applied = new Date(this.appliedAt);
  const diffTime = now - applied;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for unread messages count
JobApplicationSchema.virtual('unreadMessagesCount').get(function() {
  return this.messages ? this.messages.filter(msg => !msg.isRead).length : 0;
});

// Pre-save middleware
JobApplicationSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Static method to find applications by job
JobApplicationSchema.statics.findByJob = function(jobId) {
  return this.find({ job: jobId })
    .populate('applicant', 'email role')
    .populate('job', 'title department')
    .sort({ appliedAt: -1 });
};

// Static method to find applications by applicant
JobApplicationSchema.statics.findByApplicant = function(applicantId) {
  return this.find({ applicant: applicantId })
    .populate('job', 'title department school')
    .populate('school', 'schoolName')
    .sort({ appliedAt: -1 });
};

// Static method to find applications by school
JobApplicationSchema.statics.findBySchool = function(schoolId) {
  return this.find({ school: schoolId })
    .populate('applicant', 'email role')
    .populate('job', 'title department')
    .sort({ appliedAt: -1 });
};

// Instance method to update status
JobApplicationSchema.methods.updateStatus = function(newStatus, userId) {
  this.status = newStatus;
  this.reviewedAt = new Date();
  this.reviewedBy = userId;
  return this.save();
};

// Instance method to add message
JobApplicationSchema.methods.addMessage = function(senderId, message) {
  this.messages.push({
    sender: senderId,
    message: message,
    timestamp: new Date(),
    isRead: false
  });
  return this.save();
};

// Instance method to mark messages as read
JobApplicationSchema.methods.markMessagesAsRead = function() {
  this.messages.forEach(msg => {
    msg.isRead = true;
  });
  return this.save();
};

module.exports = mongoose.model('JobApplication', JobApplicationSchema);




