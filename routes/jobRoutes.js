const express = require('express');
const router = express.Router();
const {
  createJob,
  getJobs,
  getJob,
  updateJob,
  deleteJob,
  publishJob,
  pauseJob,
  getJobsBySchool,
  getMyJobs,
  getFeaturedJobs,
  searchJobs
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getJobs);
router.get('/featured', getFeaturedJobs);
router.get('/search', searchJobs);
router.get('/school/:schoolId', getJobsBySchool);

// Protected routes
router.use(protect);

// Job management routes
router.post('/', authorize('school', 'admin'), createJob);
router.get('/my-jobs', authorize('school', 'admin'), getMyJobs);
router.put('/:id', authorize('school', 'admin'), updateJob);
router.delete('/:id', authorize('school', 'admin'), deleteJob);
router.post('/:id/publish', authorize('school', 'admin'), publishJob);
router.post('/:id/pause', authorize('school', 'admin'), pauseJob);

// This must come last to avoid conflicts with specific routes
router.get('/:id', getJob);

module.exports = router;