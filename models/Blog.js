const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Blog title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Blog content is required'],
    minlength: [50, 'Content must be at least 50 characters']
  },
  excerpt: {
    type: String,
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['tips', 'interview-prep', 'updates', 'general'],
      message: 'Category must be one of: tips, interview-prep, updates, general'
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Each tag cannot exceed 30 characters']
  }],
  media: [{
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    }
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isApproved: {
      type: Boolean,
      default: true
    }
  }],
  publishedAt: {
    type: Date
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
BlogSchema.index({ category: 1, status: 1 });
BlogSchema.index({ author: 1 });
BlogSchema.index({ publishedAt: -1 });
BlogSchema.index({ featured: 1, status: 1 });
BlogSchema.index({ tags: 1 });

// Virtual for like count
BlogSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
BlogSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for reading time (estimated)
BlogSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Pre-save middleware to set publishedAt when status changes to published
BlogSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  this.lastModified = new Date();
  next();
});

// Pre-save middleware to generate excerpt if not provided
BlogSchema.pre('save', function(next) {
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 300).replace(/\s+\S*$/, '') + '...';
  }
  next();
});

// Static method to get published blogs
BlogSchema.statics.getPublished = function(filters = {}) {
  const query = { status: 'published', ...filters };
  return this.find(query)
    .populate('author', 'email role')
    .sort({ publishedAt: -1 });
};

// Static method to get featured blogs
BlogSchema.statics.getFeatured = function() {
  return this.find({ status: 'published', featured: true })
    .populate('author', 'email role')
    .sort({ publishedAt: -1 });
};

// Static method to get blogs by category
BlogSchema.statics.getByCategory = function(category) {
  return this.find({ status: 'published', category })
    .populate('author', 'email role')
    .sort({ publishedAt: -1 });
};

// Instance method to add like
BlogSchema.methods.addLike = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to remove like
BlogSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(like => like.toString() !== userId.toString());
  return this.save();
};

// Instance method to add comment
BlogSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content: content.trim()
  });
  return this.save();
};

// Instance method to increment views
BlogSchema.methods.incrementViews = function() {
  this.views += 1;
  // Truncate excerpt if it exceeds 300 characters before saving
  if (this.excerpt && this.excerpt.length > 300) {
    this.excerpt = this.excerpt.substring(0, 300).replace(/\s+\S*$/, '') + '...';
  }
  return this.save();
};

module.exports = mongoose.model('Blog', BlogSchema);
