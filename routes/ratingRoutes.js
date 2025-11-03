const express = require('express');
const router = express.Router();
const {
  submitRating,
  getSchoolRatings,
  getTeacherRating,
  deleteRating
} = require('../controllers/ratingController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

// @route   GET /api/ratings/school/:schoolId
// @access  Public
router.get('/school/:schoolId', getSchoolRatings);

// All other routes are protected
router.use(protect);

// @route   POST /api/ratings
// @access  Private (Teacher)
router.post('/', [
  body('schoolId').isMongoId().withMessage('Valid school ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review cannot exceed 500 characters'),
  body('categories.workEnvironment').optional().isInt({ min: 1, max: 5 }),
  body('categories.management').optional().isInt({ min: 1, max: 5 }),
  body('categories.salary').optional().isInt({ min: 1, max: 5 }),
  body('categories.benefits').optional().isInt({ min: 1, max: 5 }),
  body('categories.careerGrowth').optional().isInt({ min: 1, max: 5 }),
  body('isAnonymous').optional().isBoolean()
], authorize('teacher'), submitRating);

// @route   GET /api/ratings/school/:schoolId/teacher
// @access  Private (Teacher)
router.get('/school/:schoolId/teacher', authorize('teacher'), getTeacherRating);

// @route   DELETE /api/ratings/:ratingId
// @access  Private (Teacher)
router.delete('/:ratingId', authorize('teacher'), deleteRating);

module.exports = router;
