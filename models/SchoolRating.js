const mongoose = require('mongoose');

const SchoolRatingSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School reference is required']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher reference is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must be at most 5']
  },
  review: {
    type: String,
    maxlength: [500, 'Review cannot exceed 500 characters'],
    trim: true
  },
  categories: {
    workEnvironment: {
      type: Number,
      min: 1,
      max: 5
    },
    management: {
      type: Number,
      min: 1,
      max: 5
    },
    salary: {
      type: Number,
      min: 1,
      max: 5
    },
    benefits: {
      type: Number,
      min: 1,
      max: 5
    },
    careerGrowth: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure one rating per teacher per school
SchoolRatingSchema.index({ school: 1, teacher: 1 }, { unique: true });

// Index for efficient queries
SchoolRatingSchema.index({ school: 1, rating: 1 });
SchoolRatingSchema.index({ teacher: 1 });
SchoolRatingSchema.index({ createdAt: -1 });

// Virtual for formatted date
SchoolRatingSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Static method to get average rating for a school
SchoolRatingSchema.statics.getAverageRating = async function(schoolId) {
  const result = await this.aggregate([
    { $match: { school: mongoose.Types.ObjectId.isValid(schoolId) ? new mongoose.Types.ObjectId(schoolId) : schoolId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        workEnvironment: { $avg: '$categories.workEnvironment' },
        management: { $avg: '$categories.management' },
        salary: { $avg: '$categories.salary' },
        benefits: { $avg: '$categories.benefits' },
        careerGrowth: { $avg: '$categories.careerGrowth' }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      workEnvironment: 0,
      management: 0,
      salary: 0,
      benefits: 0,
      careerGrowth: 0
    };
  }

  return {
    averageRating: Math.round((result[0].averageRating || 0) * 10) / 10,
    totalRatings: result[0].totalRatings,
    workEnvironment: Math.round((result[0].workEnvironment || 0) * 10) / 10,
    management: Math.round((result[0].management || 0) * 10) / 10,
    salary: Math.round((result[0].salary || 0) * 10) / 10,
    benefits: Math.round((result[0].benefits || 0) * 10) / 10,
    careerGrowth: Math.round((result[0].careerGrowth || 0) * 10) / 10
  };
};

module.exports = mongoose.model('SchoolRating', SchoolRatingSchema);
