const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: [
      'Elementary', 'Middle School', 'High School', 'Special Education',
      'Mathematics', 'Science', 'English', 'Social Studies', 'Art',
      'Music', 'Physical Education', 'Technology', 'Administration',
      'Counseling', 'Library', 'Other'
    ]
  },
  employmentType: {
    type: String,
    required: [true, 'Employment type is required'],
    enum: ['full-time', 'part-time', 'contract', 'substitute', 'temporary'],
    default: 'full-time'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  applicationDeadline: {
    type: Date,
    required: [true, 'Application deadline is required']
  },

  // School Information
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School reference is required']
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Posted by user is required']
  },

  // Job Details
  description: {
    type: String,
    required: [true, 'Job description is required'],
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  responsibilities: [{
    type: String,
    trim: true
  }],
  requirements: {
    education: {
      type: String,
      required: [true, 'Education requirement is required']
    },
    experience: {
      type: String,
      required: [true, 'Experience requirement is required']
    },
    certifications: [{
      type: String,
      trim: true
    }],
    skills: [{
      type: String,
      trim: true
    }]
  },

  // Compensation
  salary: {
    min: {
      type: Number,
      min: [0, 'Minimum salary cannot be negative']
    },
    max: {
      type: Number,
      min: [0, 'Maximum salary cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
    },
    negotiable: {
      type: Boolean,
      default: false
    }
  },
  benefits: [{
    type: String,
    trim: true
  }],
  perks: [{
    type: String,
    trim: true
  }],

  // Location & Schedule
  location: {
    address: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: 'United States'
    },
    zipCode: String,
    remote: {
      type: Boolean,
      default: false
    },
    hybrid: {
      type: Boolean,
      default: false
    }
  },
  schedule: {
    hours: String,
    days: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    flexibility: {
      type: String,
      enum: ['Fixed', 'Flexible', 'Part-time flexible']
    }
  },

  // Application Process
  applicationProcess: {
    steps: [{
      type: String,
      trim: true
    }],
    documents: [{
      type: String,
      trim: true
    }],
    interviewProcess: String
  },

  // Status & Analytics
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'closed', 'expired'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  applications: {
    type: Number,
    default: 0
  },
  savedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  },

  // SEO & Marketing
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Additional Information
  urgent: {
    type: Boolean,
    default: false
  },
  internalNotes: String,
  externalJobId: String, // For integration with external job boards
  source: {
    type: String,
    enum: ['internal', 'linkedin', 'indeed', 'glassdoor'],
    default: 'internal'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
JobSchema.index({ school: 1, status: 1 });
JobSchema.index({ title: 'text', description: 'text', tags: 'text' });
JobSchema.index({ location: 1 });
JobSchema.index({ employmentType: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ expiresAt: 1 });

// Virtual for days until deadline
JobSchema.virtual('daysUntilDeadline').get(function() {
  const now = new Date();
  const deadline = new Date(this.applicationDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for application rate
JobSchema.virtual('applicationRate').get(function() {
  if (this.views === 0) return 0;
  return ((this.applications / this.views) * 100).toFixed(2);
});

// Pre-save middleware
JobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-generate tags from title and description
  if (this.isModified('title') || this.isModified('description')) {
    const text = `${this.title} ${this.description}`.toLowerCase();
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    const words = text.split(/\W+/).filter(word => 
      word.length > 3 && !commonWords.includes(word)
    );
    this.tags = [...new Set(words)].slice(0, 10); // Top 10 unique words
  }
  
  next();
});

// Static method to find active jobs
JobSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active', 
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to find jobs by school
JobSchema.statics.findBySchool = function(schoolId) {
  return this.find({ school: schoolId }).populate('postedBy', 'email role');
};

// Instance method to increment views
JobSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Instance method to increment applications
JobSchema.methods.incrementApplications = function() {
  this.applications += 1;
  return this.save();
};

module.exports = mongoose.model('Job', JobSchema);