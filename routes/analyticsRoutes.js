const express = require('express');
const router = express.Router();
const {
  getJobAnalytics,
  getSchoolAnalytics,
  getAdminAnalytics,
  getAnalyticsByDateRange,
  exportAnalytics
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Analytics routes
router.get('/job/:jobId', authorize('school', 'admin'), getJobAnalytics);
router.get('/school', authorize('school', 'admin'), getSchoolAnalytics);
router.get('/admin', authorize('admin'), getAdminAnalytics);
router.get('/range', authorize('school', 'admin'), getAnalyticsByDateRange);
router.get('/export', authorize('school', 'admin'), exportAnalytics);

module.exports = router;




