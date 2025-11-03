const asyncHandler = require('express-async-handler');
const Plan = require('../models/Plan');

// @desc Get all plans (for admin and users)
// @route GET /api/plans
// @access Public (users can view)
const getPlans = asyncHandler(async (req, res) => {
  const { userType } = req.query;
  const filter = { isActive: true };
  
  if (userType) {
    filter.userType = userType;
  }
  
  const plans = await Plan.find(filter).sort({ price: 1 });
  res.json(plans);
});

// @desc Create a new plan
// @route POST /api/plans
// @access Private (admin only)
const createPlan = asyncHandler(async (req, res) => {
  const { title, price, durationMonths, description, features, userType } = req.body;
  const plan = await Plan.create({ 
    title, 
    price, 
    durationMonths, 
    description, 
    features, 
    userType: userType || 'school' 
  });

  // Emit real-time event for plan creation
  if (global.io) {
    global.io.emit('plan_created', plan);
    console.log('Emitted plan_created event:', plan.title);
  }

  res.status(201).json(plan);
});

// @desc Update a plan
// @route PUT /api/plans/:id
// @access Private (admin only)
const updatePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const plan = await Plan.findByIdAndUpdate(id, req.body, { new: true });

  // Emit real-time event for plan update
  if (global.io) {
    global.io.emit('plan_updated', plan);
    console.log('Emitted plan_updated event:', plan.title);
  }

  res.json(plan);
});

// @desc Delete a plan
// @route DELETE /api/plans/:id
// @access Private (admin only)
const deletePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Plan.findByIdAndDelete(id);

  // Emit real-time event for plan deletion
  if (global.io) {
    global.io.emit('plan_deleted', id);
    console.log('Emitted plan_deleted event for plan ID:', id);
  }

  res.json({ message: 'Plan deleted successfully' });
});

// @desc Toggle plan system (enable/disable)
// @route POST /api/plans/toggle-system
// @access Private (admin only)
const togglePlanSystem = asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  
  // Store the plan system status in a simple way
  // You could use a database collection for this, but for simplicity, we'll use environment variable
  process.env.PLAN_SYSTEM_ENABLED = enabled ? 'true' : 'false';
  
  res.json({ 
    success: true, 
    message: `Plan system ${enabled ? 'enabled' : 'disabled'}`,
    enabled 
  });
});

// @desc Get plan system status
// @route GET /api/plans/system-status
// @access Public
const getPlanSystemStatus = asyncHandler(async (req, res) => {
  const enabled = process.env.PLAN_SYSTEM_ENABLED === 'true';
  const schoolPlansEnabled = process.env.SCHOOL_PLANS_ENABLED !== 'false';
  const teacherPlansEnabled = process.env.TEACHER_PLANS_ENABLED !== 'false';
  
  res.json({ 
    enabled,
    planSystemEnabled: enabled,
    schoolPlansEnabled,
    teacherPlansEnabled
  });
});

// @desc Toggle school plans
// @route PUT /api/plans/school-status
// @access Private (admin only)
const toggleSchoolPlans = asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  
  process.env.SCHOOL_PLANS_ENABLED = enabled ? 'true' : 'false';
  
  res.json({ 
    success: true, 
    message: `School plans ${enabled ? 'enabled' : 'disabled'}`,
    enabled 
  });
});

// @desc Toggle teacher plans
// @route PUT /api/plans/teacher-status
// @access Private (admin only)
const toggleTeacherPlans = asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  
  process.env.TEACHER_PLANS_ENABLED = enabled ? 'true' : 'false';
  
  res.json({ 
    success: true, 
    message: `Teacher plans ${enabled ? 'enabled' : 'disabled'}`,
    enabled 
  });
});

module.exports = { 
  getPlans, 
  createPlan, 
  updatePlan, 
  deletePlan, 
  togglePlanSystem, 
  getPlanSystemStatus,
  toggleSchoolPlans,
  toggleTeacherPlans
};
