const mongoose = require('mongoose');

const schoolPostSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' }
  }],
  tags: [{ type: String, trim: true }], // e.g., annual-day, sports, achievement, appreciation
  commentsCount: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('SchoolPost', schoolPostSchema);


