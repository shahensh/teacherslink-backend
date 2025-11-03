const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @desc   Check if teacher has active subscription
// @access Private (teacher)
const requireTeacherSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get user from database
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });
  }

  // Check if user is a teacher
  if (user.role !== 'teacher') {
    return res.status(403).json({ 
      success: false, 
      message: 'This endpoint is only for teachers' 
    });
  }

  // Check if teacher has active subscription
  const hasActivePlan = user.plan.isPremium && 
    user.plan.expiresAt && 
    new Date() < new Date(user.plan.expiresAt);

  if (!hasActivePlan) {
    return res.status(403).json({ 
      success: false, 
      message: 'Active subscription required to access this feature',
      requiresSubscription: true,
      userRole: 'teacher'
    });
  }

  // Teacher has active subscription, proceed
  next();
});

// @desc   Check if school has active subscription
// @access Private (school)
const requireSchoolSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get user from database
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });
  }

  // Check if user is a school
  if (user.role !== 'school') {
    return res.status(403).json({ 
      success: false, 
      message: 'This endpoint is only for schools' 
    });
  }

  // Check if school has active subscription
  const hasActivePlan = user.plan.isPremium && 
    user.plan.expiresAt && 
    new Date() < new Date(user.plan.expiresAt);

  if (!hasActivePlan) {
    return res.status(403).json({ 
      success: false, 
      message: 'Active subscription required to access this feature',
      requiresSubscription: true,
      userRole: 'school'
    });
  }

  // School has active subscription, proceed
  next();
});

module.exports = {
  requireTeacherSubscription,
  requireSchoolSubscription
};
