const mongoose = require('mongoose');

const JobAnalyticsSchema = new mongoose.Schema({
  // Reference Information
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job reference is required']
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School reference is required']
  },
  
  // View Analytics
  views: {
    total: {
      type: Number,
      default: 0
    },
    unique: {
      type: Number,
      default: 0
    },
    daily: [{
      date: Date,
      count: Number
    }],
    sources: [{
      source: {
        type: String,
        enum: ['direct', 'search', 'social', 'email', 'referral', 'other']
      },
      count: Number
    }]
  },
  
  // Application Analytics
  applications: {
    total: {
      type: Number,
      default: 0
    },
    daily: [{
      date: Date,
      count: Number
    }],
    byStatus: [{
      status: String,
      count: Number
    }],
    conversionRate: {
      type: Number,
      default: 0
    }
  },
  
  // Engagement Analytics
  engagement: {
    timeOnPage: {
      average: Number,
      total: Number
    },
    bounceRate: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    }
  },
  
  // Geographic Analytics
  geography: {
    countries: [{
      country: String,
      views: Number,
      applications: Number
    }],
    states: [{
      state: String,
      views: Number,
      applications: Number
    }],
    cities: [{
      city: String,
      views: Number,
      applications: Number
    }]
  },
  
  // Device Analytics
  devices: {
    desktop: {
      views: Number,
      applications: Number
    },
    mobile: {
      views: Number,
      applications: Number
    },
    tablet: {
      views: Number,
      applications: Number
    }
  },
  
  // Search Analytics
  search: {
    keywords: [{
      keyword: String,
      count: Number
    }],
    searchTerms: [{
      term: String,
      count: Number
    }]
  },
  
  // Performance Metrics
  performance: {
    averageResponseTime: Number,
    timeToFirstApplication: Number,
    timeToHire: Number,
    costPerApplication: Number,
    costPerHire: Number
  },
  
  // A/B Testing
  abTesting: {
    variant: String,
    performance: {
      views: Number,
      applications: Number,
      conversionRate: Number
    }
  },
  
  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  reportGenerated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
JobAnalyticsSchema.index({ job: 1 }, { unique: true });
JobAnalyticsSchema.index({ school: 1 });
JobAnalyticsSchema.index({ lastUpdated: -1 });

// Virtual for application rate
JobAnalyticsSchema.virtual('applicationRate').get(function() {
  if (this.views.total === 0) return 0;
  return ((this.applications.total / this.views.total) * 100).toFixed(2);
});

// Virtual for top performing source
JobAnalyticsSchema.virtual('topSource').get(function() {
  if (!this.views.sources || this.views.sources.length === 0) return null;
  return this.views.sources.reduce((prev, current) => 
    (prev.count > current.count) ? prev : current
  );
});

// Virtual for top location
JobAnalyticsSchema.virtual('topLocation').get(function() {
  if (!this.geography.countries || this.geography.countries.length === 0) return null;
  return this.geography.countries.reduce((prev, current) => 
    (prev.views > current.views) ? prev : current
  );
});

// Pre-save middleware
JobAnalyticsSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  
  // Calculate conversion rate
  if (this.views.total > 0) {
    this.applications.conversionRate = ((this.applications.total / this.views.total) * 100).toFixed(2);
  }
  
  next();
});

// Static method to find analytics by job
JobAnalyticsSchema.statics.findByJob = function(jobId) {
  return this.findOne({ job: jobId })
    .populate('job', 'title department')
    .populate('school', 'schoolName');
};

// Static method to find analytics by school
JobAnalyticsSchema.statics.findBySchool = function(schoolId) {
  return this.find({ school: schoolId })
    .populate('job', 'title department')
    .sort({ lastUpdated: -1 });
};

// Instance method to increment views
JobAnalyticsSchema.methods.incrementViews = function(source = 'direct') {
  this.views.total += 1;
  
  // Update daily views
  const today = new Date().toDateString();
  const dailyView = this.views.daily.find(d => d.date.toDateString() === today);
  if (dailyView) {
    dailyView.count += 1;
  } else {
    this.views.daily.push({ date: new Date(), count: 1 });
  }
  
  // Update source views
  const sourceView = this.views.sources.find(s => s.source === source);
  if (sourceView) {
    sourceView.count += 1;
  } else {
    this.views.sources.push({ source, count: 1 });
  }
  
  return this.save();
};

// Instance method to increment applications
JobAnalyticsSchema.methods.incrementApplications = function(status = 'submitted') {
  this.applications.total += 1;
  
  // Update daily applications
  const today = new Date().toDateString();
  const dailyApp = this.applications.daily.find(d => d.date.toDateString() === today);
  if (dailyApp) {
    dailyApp.count += 1;
  } else {
    this.applications.daily.push({ date: new Date(), count: 1 });
  }
  
  // Update status applications
  const statusApp = this.applications.byStatus.find(s => s.status === status);
  if (statusApp) {
    statusApp.count += 1;
  } else {
    this.applications.byStatus.push({ status, count: 1 });
  }
  
  return this.save();
};

// Instance method to update engagement
JobAnalyticsSchema.methods.updateEngagement = function(timeOnPage, action) {
  if (action === 'share') {
    this.engagement.shares += 1;
  } else if (action === 'save') {
    this.engagement.saves += 1;
  }
  
  if (timeOnPage) {
    this.engagement.timeOnPage.total += timeOnPage;
    this.engagement.timeOnPage.average = this.engagement.timeOnPage.total / this.views.total;
  }
  
  return this.save();
};

// Instance method to add geographic data
JobAnalyticsSchema.methods.addGeographicData = function(country, state, city) {
  // Update country
  const countryData = this.geography.countries.find(c => c.country === country);
  if (countryData) {
    countryData.views += 1;
  } else {
    this.geography.countries.push({ country, views: 1, applications: 0 });
  }
  
  // Update state
  if (state) {
    const stateData = this.geography.states.find(s => s.state === state);
    if (stateData) {
      stateData.views += 1;
    } else {
      this.geography.states.push({ state, views: 1, applications: 0 });
    }
  }
  
  // Update city
  if (city) {
    const cityData = this.geography.cities.find(c => c.city === city);
    if (cityData) {
      cityData.views += 1;
    } else {
      this.geography.cities.push({ city, views: 1, applications: 0 });
    }
  }
  
  return this.save();
};

module.exports = mongoose.model('JobAnalytics', JobAnalyticsSchema);




