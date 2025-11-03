const express = require('express');
const { body } = require('express-validator');
const {
  getAllWebinars,
  getWebinarById,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  joinWebinar,
  leaveWebinar,
  uploadThumbnail,
  uploadVideo,
  getWebinarStats
} = require('../controllers/webinarController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../utils/upload');

const router = express.Router();

// Public routes
router.get('/', getAllWebinars);
router.get('/stats', getWebinarStats);
router.get('/:id', getWebinarById);

// Protected routes (require authentication)
router.use(protect);

// Join/Leave webinar
router.post('/:id/join', joinWebinar);
router.post('/:id/leave', leaveWebinar);

// Admin routes (require admin role)
router.use(authorize('admin'));

// Upload webinar thumbnail
router.post('/upload-thumbnail', upload.single('thumbnail'), uploadThumbnail);

// Upload webinar video
router.post('/upload-video', upload.single('video'), uploadVideo);

// Create new webinar
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 50 })
    .withMessage('Description must be at least 50 characters'),
  body('type')
    .isIn(['live', 'recorded'])
    .withMessage('Type must be either live or recorded'),
  body('category')
    .isIn(['teaching', 'career', 'technology', 'interview-prep', 'general'])
    .withMessage('Category must be one of: teaching, career, technology, interview-prep, general'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max participants must be a positive integer'),
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('meetingLink')
    .optional()
    .isURL()
    .withMessage('Meeting link must be a valid URL'),
  body('recordingUrl')
    .optional()
    .isURL()
    .withMessage('Recording URL must be a valid URL'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('presenter.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Presenter name must be between 2 and 100 characters'),
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('Public must be a boolean value')
], createWebinar);

// Update webinar
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 50 })
    .withMessage('Description must be at least 50 characters'),
  body('type')
    .optional()
    .isIn(['live', 'recorded'])
    .withMessage('Type must be either live or recorded'),
  body('category')
    .optional()
    .isIn(['teaching', 'career', 'technology', 'interview-prep', 'general'])
    .withMessage('Category must be one of: teaching, career, technology, interview-prep, general'),
  body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max participants must be a positive integer'),
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('meetingLink')
    .optional()
    .isURL()
    .withMessage('Meeting link must be a valid URL'),
  body('recordingUrl')
    .optional()
    .isURL()
    .withMessage('Recording URL must be a valid URL'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('presenter.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Presenter name must be between 2 and 100 characters'),
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('Public must be a boolean value'),
  body('status')
    .optional()
    .isIn(['scheduled', 'live', 'completed', 'cancelled'])
    .withMessage('Status must be one of: scheduled, live, completed, cancelled')
], updateWebinar);

// Delete webinar
router.delete('/:id', deleteWebinar);

module.exports = router;
