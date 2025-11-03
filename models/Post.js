const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorProfile: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'authorProfileType'
  },
  authorProfileType: {
    type: String,
    required: true,
    enum: ['School', 'Teacher']
  },
  caption: {
    type: String,
    required: true,
    trim: true
  },
  media: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    thumbnail: String // For video thumbnails
  }],
  privacy: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  commentsCount: {
    type: Number,
    default: 0
  },
  sharesCount: {
    type: Number,
    default: 0
  },
  tags: [String],
  location: {
    name: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
postSchema.index({ authorProfile: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);