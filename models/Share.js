const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['share', 'quote', 'story'],
    default: 'share'
  }
}, {
  timestamps: true
});

// Indexes for better performance
shareSchema.index({ user: 1, createdAt: -1 });
shareSchema.index({ post: 1, createdAt: -1 });

// Virtual for user info
shareSchema.virtual('userInfo', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true
});

// Virtual for post info
shareSchema.virtual('postInfo', {
  ref: 'Post',
  localField: 'post',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
shareSchema.set('toJSON', { virtuals: true });
shareSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Share', shareSchema);

