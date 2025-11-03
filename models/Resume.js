const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    unique: true // One resume per teacher
  },

  // Personal Information
  personalInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    gender: { type: String },
    dateOfBirth: { type: Date },
    address: {
      city: { type: String },
      state: { type: String },
      country: { type: String, default: 'India' }
    }
  },

  // Professional Information
  professionalInfo: {
    headline: { type: String },
    bio: { type: String },
    skills: [{ type: String }],
    subjects: [{ type: String }],
    languages: [{ type: String }],
    achievements: [{ type: String }]
  },

  // Education
  education: [{
    degree: { type: String, required: true },
    university: { type: String, required: true },
    yearOfPassing: { type: Number, required: true },
    grade: { type: String }
  }],

  // Experience
  experience: [{
    schoolName: { type: String, required: true },
    role: { type: String, required: true },
    from: { type: Date, required: true },
    to: { type: Date },
    current: { type: Boolean, default: false },
    description: { type: String }
  }],

  // Certifications
  certifications: [{
    title: { type: String, required: true },
    issuer: { type: String, required: true },
    year: { type: Number, required: true },
    expiryDate: { type: Date }
  }],

  // Social Links
  socialLinks: {
    linkedin: { type: String },
    portfolio: { type: String },
    github: { type: String }
  },

  // File uploads
  files: {
    profileImage: { type: String }, // Cloudinary URL
    resumeFile: { type: String }    // Cloudinary URL for uploaded resume
  },

  // Resume settings
  settings: {
    template: { type: String, default: 'modern' },
    colorScheme: { type: String, default: 'blue' },
    showProfileImage: { type: Boolean, default: true },
    showSocialLinks: { type: Boolean, default: true }
  },

  // Status
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
resumeSchema.virtual('fullName').get(function() {
  return this.personalInfo.name;
});

// Virtual for total experience
resumeSchema.virtual('totalExperience').get(function() {
  let totalMonths = 0;
  this.experience.forEach(exp => {
    const startDate = new Date(exp.from);
    const endDate = exp.current ? new Date() : new Date(exp.to);
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth());
    totalMonths += months;
  });
  return Math.round((totalMonths / 12) * 10) / 10;
});

// Index for better performance
resumeSchema.index({ teacher: 1 });
resumeSchema.index({ 'personalInfo.email': 1 });

module.exports = mongoose.model('Resume', resumeSchema);





