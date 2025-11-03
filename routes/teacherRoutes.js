const express = require('express');
const router = express.Router();
const {
  getTeacherProfile,
  getTeacherProfileById,
  updateTeacherProfile,
  uploadProfileImage,
  uploadCoverImage,
  uploadResume,
  searchJobs,
  getJobDetails,
  applyForJob,
  getTeacherApplications,
  saveJob,
  getSavedJobs,
  reviewSchool,
  checkUsernameAvailability
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { requireTeacherSubscription } = require('../middleware/teacherSubscriptionMiddleware');
const { upload } = require('../utils/upload');
const { body } = require('express-validator');

// @route   GET /api/teachers/profile/:id (for viewing other teachers' profiles)
// @access  Private (Teacher or School)
router.get('/profile/:id', protect, authorize('teacher', 'school'), getTeacherProfileById);

// All other routes are protected and require teacher role
router.use(protect);
router.use(authorize('teacher'));

// @route   GET /api/teachers/profile
// @access  Private (Teacher)
router.get('/profile', getTeacherProfile);

// @route   GET /api/teachers/me
// @access  Private (Teacher)
router.get('/me', getTeacherProfile);

// @route   PUT /api/teachers/profile
// @access  Private (Teacher)
router.put('/profile', [
  body('personalInfo.firstName').optional().trim().isLength({ min: 2 }),
  body('personalInfo.lastName').optional().trim().isLength({ min: 2 }),
  body('personalInfo.phone').optional().isMobilePhone(),
  body('professionalInfo.specialization').optional().isArray({ min: 1 }),
  body('professionalInfo.gradeLevels').optional().isArray({ min: 1 }),
  body('slug').optional().trim().isLength({ min: 3, max: 30 })
], updateTeacherProfile);

// @route   POST /api/teachers/upload-profile-image
// @access  Private (Teacher)
router.post('/upload-profile-image', upload.single('profileImage'), uploadProfileImage);

// @route   POST /api/teachers/upload-cover-image
// @access  Private (Teacher)
router.post('/upload-cover-image', upload.single('coverImage'), uploadCoverImage);

// @route   GET /api/teachers/check-username/:username
// @access  Private (Teacher)
router.get('/check-username/:username', checkUsernameAvailability);

// @route   POST /api/teachers/upload-resume
// @access  Private (Teacher)
router.post('/upload-resume', upload.single('resume'), uploadResume);

// @route   GET /api/teachers/jobs/search
// @access  Private (Teacher) + Subscription Required
router.get('/jobs/search', requireTeacherSubscription, searchJobs);

// @route   GET /api/teachers/jobs/:jobId
// @access  Private (Teacher) + Subscription Required
router.get('/jobs/:jobId', requireTeacherSubscription, getJobDetails);

// @route   POST /api/teachers/jobs/:jobId/apply
// @access  Private (Teacher) + Subscription Required
router.post('/jobs/:jobId/apply', requireTeacherSubscription, [
  body('coverLetter').trim().isLength({ min: 50 }),
  body('resume').optional().isURL()
], applyForJob);

// @route   GET /api/teachers/applications
// @access  Private (Teacher) + Subscription Required
router.get('/applications', requireTeacherSubscription, getTeacherApplications);

// @route   POST /api/teachers/jobs/:jobId/save
// @access  Private (Teacher) + Subscription Required
router.post('/jobs/:jobId/save', requireTeacherSubscription, saveJob);

// @route   GET /api/teachers/saved-jobs
// @access  Private (Teacher) + Subscription Required
router.get('/saved-jobs', requireTeacherSubscription, getSavedJobs);

// @route   POST /api/teachers/schools/:schoolId/review
// @access  Private (Teacher)
router.post('/schools/:schoolId/review', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ min: 10 })
], reviewSchool);

router.put('/update', protect, authorize('teacher'), upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), updateTeacherProfile);

module.exports = router;








