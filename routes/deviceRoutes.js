const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Device = require('../models/Device');
const asyncHandler = require('express-async-handler');

// @desc    Register/Update device token for push notifications
// @route   POST /api/devices/register
// @access  Private
router.post('/register', protect, asyncHandler(async (req, res) => {
  const { fcmToken, platform, deviceId, appVersion } = req.body;
  const userId = req.user.id;

  // Gracefully handle missing token (app might not have push notifications enabled)
  if (!fcmToken || fcmToken.trim() === '') {
    console.log(`⚠️  Registration attempt without FCM token for user ${userId}`);
    return res.status(200).json({
      success: true,
      message: 'Registration skipped - FCM token not available',
      skipped: true,
      note: 'Push notifications require FCM token. This is normal if push notifications are not configured or disabled.'
    });
  }

  try {
    // Update or create device token
    const device = await Device.updateOrCreate(
      userId,
      fcmToken.trim(),
      platform || 'android',
      deviceId
    );

    console.log(`✅ Device token registered for user ${userId}, platform: ${device.platform}`);

    res.json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        deviceId: device._id,
        platform: device.platform,
        isActive: device.isActive
      }
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    
    // Don't fail the request if it's a duplicate token or similar non-critical error
    if (error.code === 11000 || error.name === 'MongoServerError') {
      return res.status(200).json({
        success: true,
        message: 'Device token already registered',
        warning: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register device token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}));

// @desc    Remove device token (on logout or app uninstall)
// @route   DELETE /api/devices/remove
// @access  Private
router.delete('/remove', protect, asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.user.id;

  // Gracefully handle missing token
  if (!fcmToken || fcmToken.trim() === '') {
    // Try to remove all devices for this user as fallback
    try {
      await Device.updateMany(
        { user: userId },
        { isActive: false }
      );
      return res.json({
        success: true,
        message: 'All device tokens removed successfully (no specific token provided)'
      });
    } catch (error) {
      return res.status(200).json({
        success: true,
        message: 'No device tokens to remove',
        skipped: true
      });
    }
  }

  try {
    // Deactivate device token
    const device = await Device.findOneAndUpdate(
      { user: userId, fcmToken: fcmToken.trim() },
      { isActive: false },
      { new: true }
    );

    if (!device) {
      // Token not found, but return success to avoid errors
      return res.json({
        success: true,
        message: 'Device token removed (token not found)',
        note: 'Token may have already been removed'
      });
    }

    console.log(`✅ Device token removed for user ${userId}`);
    res.json({
      success: true,
      message: 'Device token removed successfully'
    });
  } catch (error) {
    console.error('Error removing device token:', error);
    // Return success even on error to prevent app crashes
    res.status(200).json({
      success: true,
      message: 'Device token removal attempted',
      warning: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// @desc    Get user's registered devices
// @route   GET /api/devices
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const devices = await Device.find({
      user: userId,
      isActive: true
    }).select('platform deviceId lastActive createdAt');

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices',
      error: error.message
    });
  }
}));

module.exports = router;

