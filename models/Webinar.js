const mongoose = require('mongoose');

const WebinarSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Webinar title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Webinar description is required'],
    minlength: [50, 'Description must be at least 50 characters']
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['live', 'recorded'],
      message: 'Type must be either live or recorded'
    }
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['scheduled', 'live', 'completed', 'cancelled'],
      message: 'Status must be one of: scheduled, live, completed, cancelled'
    },
    default: 'scheduled'
  },
  scheduledDate: {
    type: Date,
    required: function() {
      return this.type === 'live';
    }
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: [1, 'Duration must be at least 1 minute']
  },
  maxParticipants: {
    type: Number,
    default: 100,
    min: [1, 'Max participants must be at least 1']
  },
  meetingLink: {
    type: String,
    required: function() {
      return this.type === 'live';
    }
  },
  recordingUrl: {
    type: String,
    required: function() {
      return this.type === 'recorded' && !this.videoFile;
    }
  },
  videoFile: {
    url: {
      type: String,
      default: null
    },
    filename: {
      type: String,
      default: null
    },
    size: {
      type: Number,
      default: null
    },
    duration: {
      type: Number, // in seconds
      default: null
    },
    format: {
      type: String,
      default: null
    }
  },
  thumbnail: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Each tag cannot exceed 30 characters']
  }],
  category: {
    type: String,
    required: true,
    enum: {
      values: ['teaching', 'career', 'technology', 'interview-prep', 'general'],
      message: 'Category must be one of: teaching, career, technology, interview-prep, general'
    }
  },
  presenter: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      trim: true
    },
    avatar: {
      type: String,
      default: null
    }
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date,
      default: null
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
WebinarSchema.index({ type: 1, status: 1 });
WebinarSchema.index({ category: 1, isPublic: 1 });
WebinarSchema.index({ scheduledDate: 1 });
WebinarSchema.index({ isFeatured: 1, status: 1 });
WebinarSchema.index({ 'presenter.name': 'text', title: 'text', description: 'text' });

// Virtual for webinar duration in hours and minutes
WebinarSchema.virtual('durationFormatted').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Virtual for attendee count
WebinarSchema.virtual('attendeeCount').get(function() {
  return this.attendees.length;
});


// Pre-save middleware to update status based on scheduled date
WebinarSchema.pre('save', function(next) {
  if (this.type === 'live' && this.scheduledDate) {
    const now = new Date();
    if (this.scheduledDate <= now && this.status === 'scheduled') {
      this.status = 'live';
    } else if (this.scheduledDate > now && this.status === 'live') {
      this.status = 'scheduled';
    }
  }
  next();
});

module.exports = mongoose.model('Webinar', WebinarSchema);
