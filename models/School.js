const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  schoolName: {
    type: String,
    required: [true, 'School name is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'School description is required']
  },
  coverImage: String,
  profileImage: String,
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    website: String,
    socialMedia: {
      facebook: String,
      twitter: String,
      linkedin: String
    }
  },
  facilities: [String],
  photos: [String], // URLs to uploaded photos
  vision: String,
  mission: String,
  establishedYear: Number,
  establishedDate: Date,
  board: {
    type: String,
    enum: ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Other']
  },
  schoolType: {
    type: String,
    enum: ['Public', 'Private', 'Government', 'International']
  },
  grades: {
    from: Number,
    to: Number
  },
  studentCount: Number,
  teacherCount: Number,
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [String],
  plan: {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    title: { type: String, default: '' },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    isPremium: { type: Boolean, default: false }
  },  
  subscriptionPlan: {
    type: String,
    enum: ['free', 'premium', 'enterprise'],
    default: 'free'
  },
  subscriptionExpiry: Date,
  achievements: [{
    title: String,
    description: String,
    date: Date,
    image: String
  }],
  reviews: [{
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate average rating
schoolSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
  } else {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = sum / this.reviews.length;
  }
  return this.averageRating;
};

module.exports = mongoose.model('School', schoolSchema);

