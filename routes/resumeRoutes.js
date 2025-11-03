const express = require('express');
const router = express.Router();
const { 
  createOrUpdateResume,
  getMyResume,
  getTeacherResume,
  generateResumePDF,
  generateTeacherResumePDF,
  deleteResume
} = require('../controllers/resumeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Protected routes
router.use(protect);

// Teacher routes
router.post('/', authorize('teacher'), createOrUpdateResume);
router.get('/me', authorize('teacher'), getMyResume);
router.get('/me/pdf', authorize('teacher'), generateTeacherResumePDF);
router.delete('/me', authorize('teacher'), deleteResume);

// School/Admin routes
router.get('/teacher/:teacherId', authorize(['school', 'admin']), getTeacherResume);
router.get('/teacher/:teacherId/pdf', authorize(['school', 'admin']), generateTeacherResumePDF);

// PDF generation routes
router.get('/:resumeId/pdf', authorize(['teacher', 'school', 'admin']), generateResumePDF);

module.exports = router;

