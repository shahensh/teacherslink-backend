/**
 * Script to update all existing jobs to use INR currency
 * Run this once to migrate existing data
 */

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const updateCurrency = async () => {
  try {
    await connectDB();
    
    const Job = require('../models/Job');
    
    // Find all jobs where currency is not set or is USD
    const result = await Job.updateMany(
      {
        $or: [
          { 'salary.currency': { $exists: false } },
          { 'salary.currency': 'USD' },
          { 'salary.currency': null }
        ]
      },
      {
        $set: { 'salary.currency': 'INR' }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} jobs to INR currency`);
    
    // Show sample of updated jobs
    const sampleJobs = await Job.find({ 'salary.currency': 'INR' })
      .limit(5)
      .select('title salary');
    
    console.log('\n📋 Sample updated jobs:');
    sampleJobs.forEach(job => {
      console.log(`  - ${job.title}: ₹${job.salary?.min || 0} - ₹${job.salary?.max || 0}`);
    });
    
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating currency:', error);
    process.exit(1);
  }
};

// Run the migration
updateCurrency();


