const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending'
  },
  acceptedAt: Date
}, {
  timestamps: true
});

// Compound index to ensure unique connections
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Indexes for efficient queries
connectionSchema.index({ requester: 1, status: 1 });
connectionSchema.index({ recipient: 1, status: 1 });

// Virtual for requester info
connectionSchema.virtual('requesterInfo', {
  ref: 'User',
  localField: 'requester',
  foreignField: '_id',
  justOne: true
});

// Virtual for recipient info
connectionSchema.virtual('recipientInfo', {
  ref: 'User',
  localField: 'recipient',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
connectionSchema.set('toJSON', { virtuals: true });
connectionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Connection', connectionSchema);

