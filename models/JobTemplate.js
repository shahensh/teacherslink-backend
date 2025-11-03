const mongoose = require('mongoose');

const JobTemplateSchema = new mongoose.Schema({
  // Template Information
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Elementary Teacher', 'Middle School Teacher', 'High School Teacher',
      'Special Education', 'Administrator', 'Counselor', 'Librarian',
      'Art Teacher', 'Music Teacher', 'PE Teacher', 'Technology',
      'Substitute Teacher', 'Part-time', 'Contract', 'Other'
    ]
  },
  
  // Template Data
  templateData: {
    // Basic Information
    title: {
      type: String,
      required: [true, 'Job title is required']
    },
    department: {
      type: String,
      required: [true, 'Department is required']
    },
    employmentType: {
      type: String,
      required: [true, 'Employment type is required']
    },
    
    // Job Details
    description: {
      type: String,
      required: [true, 'Job description is required']
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
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'USD'
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
    }
  },
  
  // Template Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School reference is required']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
JobTemplateSchema.index({ school: 1, isActive: 1 });
JobTemplateSchema.index({ category: 1 });
JobTemplateSchema.index({ isPublic: 1, isActive: 1 });
JobTemplateSchema.index({ name: 'text', description: 'text' });

// Pre-save middleware
JobTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find public templates
JobTemplateSchema.statics.findPublic = function() {
  return this.find({ 
    isPublic: true, 
    isActive: true 
  }).populate('createdBy', 'email').populate('school', 'schoolName');
};

// Static method to find templates by school
JobTemplateSchema.statics.findBySchool = function(schoolId) {
  return this.find({ 
    school: schoolId, 
    isActive: true 
  }).populate('createdBy', 'email');
};

// Instance method to increment usage
JobTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

module.exports = mongoose.model('JobTemplate', JobTemplateSchema);




