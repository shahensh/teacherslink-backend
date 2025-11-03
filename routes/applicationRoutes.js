const express = require('express');
const router = express.Router();
const { 
  submitApplication, 
  listMyApplications, 
  checkApplicationStatus,
  getSchoolApplications,
  getApplication,
  updateApplicationStatus,
  updateApplication,
  getResumeFile,
  debugTeachers,
  createApplication
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadApplicationFiles, handleUploadError } = require('../middleware/fileUpload');

// Protected routes
router.use(protect);

// Teachers submit applications
router.post('/', authorize('teacher'), uploadApplicationFiles, handleUploadError, submitApplication);

// Create general inquiry application
router.post('/create', authorize('teacher'), createApplication);

// Teacher list own applications
router.get('/my', authorize('teacher'), listMyApplications);

// School get applications for their jobs
router.get('/school', authorize('school'), getSchoolApplications);

// Debug endpoint for teacher profiles
router.get('/debug-teachers', authorize('school'), debugTeachers);

// Teacher check application status for a specific job
router.get('/check/:jobId', authorize('teacher'), checkApplicationStatus);

// School update application status
router.put('/:id/status', authorize('school'), updateApplicationStatus);

// School update application details (including interview details)
router.put('/:id', authorize('school'), updateApplication);

// Get resume file (accessible by school, teacher, and admin)
router.get('/:id/resume', getResumeFile);

// Get single application (accessible by school, teacher, and admin) - MUST BE LAST
router.get('/:id', getApplication);
router.options('/:id/resume', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(200).end();
});

module.exports = router;


