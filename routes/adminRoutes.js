const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  verifySchool,
  getPendingVerifications,
  getAllJobsAdmin,
  updateJobStatus,
  getAllApplications,
  getSystemAnalytics,
  getTeachersWithSubscriptions,
  getSchoolsWithSubscriptions
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/dashboard
// @access  Private (Admin)
router.get('/dashboard', getDashboardStats);

// @route   GET /api/admin/users
// @access  Private (Admin)
router.get('/users', getAllUsers);

// @route   GET /api/admin/users/:id
// @access  Private (Admin)
router.get('/users/:id', getUserById);

// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
router.put('/users/:id/status', [
  body('isActive').optional().isBoolean(),
  body('isVerified').optional().isBoolean()
], updateUserStatus);

// @route   PUT /api/admin/schools/:id/verify
// @access  Private (Admin)
router.put('/schools/:id/verify', verifySchool);

// @route   GET /api/admin/verifications
// @access  Private (Admin)
router.get('/verifications', getPendingVerifications);

// @route   GET /api/admin/jobs
// @access  Private (Admin)
router.get('/jobs', getAllJobsAdmin);

// @route   PUT /api/admin/jobs/:id/status
// @access  Private (Admin)
router.put('/jobs/:id/status', [
  body('isActive').isBoolean()
], updateJobStatus);

// @route   GET /api/admin/applications
// @access  Private (Admin)
router.get('/applications', getAllApplications);

// @route   GET /api/admin/analytics
// @access  Private (Admin)
router.get('/analytics', getSystemAnalytics);

// @route   GET /api/admin/teachers
// @access  Private (Admin)
router.get('/teachers', getTeachersWithSubscriptions);

// @route   GET /api/admin/schools
// @access  Private (Admin)
router.get('/schools', getSchoolsWithSubscriptions);

module.exports = router;








