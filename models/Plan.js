const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    durationMonths: { type: Number, required: true }, // e.g., 12 for 1 year
    description: { type: String },
    features: [{ type: String }],
    userType: { 
      type: String, 
      enum: ['school', 'teacher'], 
      required: true,
      default: 'school'
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
