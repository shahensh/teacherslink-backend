const mongoose = require('mongoose');

const deviceSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true
    // unique: true automatically creates an index, no need for separate index: true
  },
  platform: {
    type: String,
    enum: ['android', 'ios', 'web'],
    default: 'android'
  },
  deviceId: {
    type: String,
    // Device identifier to prevent duplicate tokens
  },
  appVersion: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
deviceSchema.index({ user: 1, isActive: 1 });
// fcmToken already has unique index from unique: true, no need for duplicate

// Remove old tokens when same device registers new token
deviceSchema.statics.updateOrCreate = async function(userId, fcmToken, platform, deviceId) {
  // If deviceId provided, remove old tokens for same device
  if (deviceId) {
    await this.updateMany(
      { user: userId, deviceId: deviceId, fcmToken: { $ne: fcmToken } },
      { isActive: false }
    );
  }

  // Update or create device token
  const device = await this.findOneAndUpdate(
    { fcmToken: fcmToken },
    {
      user: userId,
      platform: platform || 'android',
      deviceId: deviceId,
      isActive: true,
      lastActive: new Date()
    },
    { upsert: true, new: true }
  );

  return device;
};

module.exports = mongoose.model('Device', deviceSchema);

