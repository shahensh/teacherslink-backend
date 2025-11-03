const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixNotificationIds() {
  try {
    console.log('🔧 Starting notification ID fix...');
    
    // Find all notifications
    const notifications = await Notification.find({});
    console.log(`📊 Found ${notifications.length} notifications to check`);
    
    let fixedCount = 0;
    
    for (const notification of notifications) {
      let needsUpdate = false;
      const updateData = {};
      
      // Check and fix jobId
      if (notification.data?.jobId && typeof notification.data.jobId === 'object') {
        updateData['data.jobId'] = notification.data.jobId._id || notification.data.jobId.toString();
        needsUpdate = true;
        console.log(`🔧 Fixing jobId for notification ${notification._id}: ${notification.data.jobId} -> ${updateData['data.jobId']}`);
      }
      
      // Check and fix schoolId
      if (notification.data?.schoolId && typeof notification.data.schoolId === 'object') {
        updateData['data.schoolId'] = notification.data.schoolId._id || notification.data.schoolId.toString();
        needsUpdate = true;
        console.log(`🔧 Fixing schoolId for notification ${notification._id}: ${notification.data.schoolId} -> ${updateData['data.schoolId']}`);
      }
      
      // Check and fix applicationId
      if (notification.data?.applicationId && typeof notification.data.applicationId === 'object') {
        updateData['data.applicationId'] = notification.data.applicationId._id || notification.data.applicationId.toString();
        needsUpdate = true;
        console.log(`🔧 Fixing applicationId for notification ${notification._id}: ${notification.data.applicationId} -> ${updateData['data.applicationId']}`);
      }
      
      if (needsUpdate) {
        await Notification.findByIdAndUpdate(notification._id, { $set: updateData });
        fixedCount++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} notifications`);
    console.log('🎉 Notification ID fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing notification IDs:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the fix
fixNotificationIds();
