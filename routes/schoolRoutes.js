const express = require('express');
const router = express.Router();
const {
  getSchoolProfile,
  getSchoolProfileById,
  updateSchoolProfile,
  uploadProfileImage,
  uploadCoverImage,
  uploadPhotos,
  postJob,
  getSchoolJobs,
  getJobApplications,
  updateApplicationStatus,
  scheduleInterview,
  addAchievement,
  checkUsernameAvailability
} = require('../controllers/schoolController');
const { protect, authorize, requireVerification } = require('../middleware/authMiddleware');
const { requireSchoolSubscription } = require('../middleware/teacherSubscriptionMiddleware');
const { createPost, deletePost } = require('../controllers/schoolPostController');
const { upload } = require('../utils/upload');
const { body } = require('express-validator');

// @route   GET /api/schools/profile/:id (for viewing other schools' profiles)
// @access  Private (Teacher, School, or Admin)
router.get('/profile/:id', protect, authorize(['teacher', 'school', 'admin']), getSchoolProfileById);

// All other routes are protected and require school role
router.use(protect);
router.use(authorize('school'));

// @route   GET /api/schools/profile
// @access  Private (School)
router.get('/profile', getSchoolProfile);

// @route   PUT /api/schools/profile
// @access  Private (School)
router.put('/profile', [
  body('schoolName').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('contactInfo.phone').optional().isMobilePhone(),
  body('contactInfo.email').optional().isEmail(),
  body('slug').optional().trim().isLength({ min: 3, max: 30 })
], updateSchoolProfile);

// @route   GET /api/schools/check-username/:username
// @access  Private (School)
router.get('/check-username/:username', checkUsernameAvailability);

// @route   POST /api/schools/upload-profile-image
// @access  Private (School)
router.post('/upload-profile-image', upload.single('profileImage'), uploadProfileImage);

// @route   POST /api/schools/upload-cover-image
// @access  Private (School)
router.post('/upload-cover-image', upload.single('coverImage'), uploadCoverImage);

// @route   POST /api/schools/upload-photos
// @access  Private (School)
router.post('/upload-photos', upload.array('photos', 10), uploadPhotos);

// @route   POST /api/schools/jobs
// @access  Private (School) + Subscription Required
router.post('/jobs', requireVerification, requireSchoolSubscription, [
  body('title').trim().isLength({ min: 5 }),
  body('description').trim().isLength({ min: 20 }),
  body('jobDetails.subject').exists(),
  body('jobDetails.gradeLevel').isArray({ min: 1 }),
  body('jobDetails.jobType').isIn(['Full-time', 'Part-time', 'Contract', 'Internship']),
  body('jobDetails.workMode').isIn(['On-site', 'Remote', 'Hybrid']),
  body('location.city').exists(),
  body('location.state').exists()
], postJob);

// @route   GET /api/schools/jobs
// @access  Private (School)
router.get('/jobs', getSchoolJobs);

// @route   GET /api/schools/jobs/:jobId/applications
// @access  Private (School)
router.get('/jobs/:jobId/applications', getJobApplications);

// @route   PUT /api/schools/applications/:applicationId/status
// @access  Private (School)
router.put('/applications/:applicationId/status', [
  body('status').isIn(['pending', 'reviewed', 'shortlisted', 'interviewed', 'accepted', 'rejected', 'withdrawn']),
  body('reviewNotes').optional().trim()
], updateApplicationStatus);

// @route   POST /api/schools/applications/:applicationId/interview
// @access  Private (School)
router.post('/applications/:applicationId/interview', [
  body('scheduledDate').isISO8601(),
  body('interviewType').isIn(['Phone', 'Video', 'In-person', 'Panel']),
  body('interviewer').optional().trim(),
  body('notes').optional().trim()
], scheduleInterview);

// @route   POST /api/schools/achievements
// @access  Private (School)
router.post('/achievements', [
  body('title').trim().isLength({ min: 5 }),
  body('description').trim().isLength({ min: 10 }),
  body('date').optional().isISO8601()
], addAchievement);

// @route   POST /api/schools/posts (multipart optional)
// @access  Private (School)
router.post('/posts', upload.array('media', 10), createPost);

// @route   DELETE /api/schools/posts/:postId
// @access  Private (School)
router.delete('/posts/:postId', deletePost);

module.exports = router;








