const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // STEP 1 - PERSONAL INFO
  personalInfo: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    phone: { type: String, required: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    },
    profilePhoto: String, // Cloud URL
    profileImage: String, // Cloud URL (alias for profilePhoto)
    coverImage: String,   // Cloud URL for cover photo
    bio: String,          // short summary or description
    headline: String      // title line, e.g. "Maths Teacher with 5+ years experience"
  },

  // STEP 2 - PROFESSIONAL / CAREER INFO
  professionalInfo: {
    qualification: [{
      degree: String,
      institution: String,
      year: Number,
      grade: String
    }],
    experience: [{
      school: String,
      position: String,
      startDate: Date,
      endDate: Date,
      current: { type: Boolean, default: false },
      description: String
    }],
    totalExperience: { type: Number, default: 0 },
    specialization: [String], // Subjects taught
    gradeLevels: [String],
    skills: [String],
    certifications: [{
      name: String,
      issuer: String,
      date: Date,
      expiryDate: Date
    }],
    achievements: [{
      title: String,
      description: String,
      date: Date,
      image: String
    }],
    languages: [String], // New: spoken languages
    resume: String, // URL to uploaded resume
    portfolio: [String] // URLs to sample works or teaching materials
  },

  // STEP 3 - PREFERENCES & SOCIAL LINKS
  preferences: {
    preferredLocation: [String],
    preferredSalary: {
      min: Number,
      max: Number,
      currency: { type: String, default: 'INR' }
    },
    jobType: [{
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Internship']
    }],
    workMode: [{
      type: String,
      enum: ['On-site', 'Remote', 'Hybrid']
    }],
    availability: {
      type: String,
      enum: ['Immediate', '1 month', '2 months', '3+ months']
    }
  },

  // SOCIAL LINKS
  socialProfiles: {
    linkedin: String,
    twitter: String,
    facebook: String,
    portfolio: String,
    github: String // optional if they upload teaching projects
  },

  // STATUS / SYSTEM FIELDS
  isProfileComplete: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationDocuments: [String],
  slug: String, // URL-friendly username
  reviews: [{
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    date: { type: Date, default: Date.now }
  }],
  averageRating: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
teacherSchema.virtual('fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for profileImage (alias for profilePhoto)
teacherSchema.virtual('profileImage').get(function() {
  return this.personalInfo.profileImage || this.personalInfo.profilePhoto;
});

// Virtual for coverImage
teacherSchema.virtual('coverImage').get(function() {
  return this.personalInfo.coverImage;
});

// Utility: Calculate average rating
teacherSchema.methods.calculateAverageRating = function () {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
  } else {
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = sum / this.reviews.length;
  }
  return this.averageRating;
};

// Utility: Calculate total experience in years
teacherSchema.methods.calculateTotalExperience = function () {
  let totalMonths = 0;
  
  if (!this.professionalInfo.experience || !Array.isArray(this.professionalInfo.experience)) {
    this.professionalInfo.totalExperience = 0;
    return 0;
  }
  
  this.professionalInfo.experience.forEach(exp => {
    if (!exp || !exp.startDate) return;
    
    try {
      const startDate = new Date(exp.startDate);
      const endDate = exp.current ? new Date() : new Date(exp.endDate);
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log('Invalid date in experience:', exp);
        return;
      }
      
      // Ensure end date is after start date
      if (endDate <= startDate) {
        console.log('End date is before or equal to start date:', exp);
        return;
      }
      
      const months =
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      
      if (months > 0) {
        totalMonths += months;
      }
    } catch (error) {
      console.log('Error calculating experience for entry:', exp, error.message);
    }
  });
  
  this.professionalInfo.totalExperience = Math.round((totalMonths / 12) * 10) / 10;
  return this.professionalInfo.totalExperience;
};

module.exports = mongoose.model('Teacher', teacherSchema);
