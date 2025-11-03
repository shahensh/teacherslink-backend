const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  validateResetToken
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    gmail_convert_googlemaildotcom: false
  }),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['teacher', 'school'])
], register);

// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    gmail_convert_googlemaildotcom: false
  }),
  body('password').exists()
], login);

// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, getMe);

// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('email').optional().isEmail().normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    gmail_convert_googlemaildotcom: false
  }),
  body('password').optional().isLength({ min: 6 })
], updateProfile);

// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 6 })
], changePassword);

// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    gmail_convert_googlemaildotcom: false
  })
], forgotPassword);

// @route   PUT /api/auth/reset-password/:token
// @access  Public
router.put('/reset-password/:token', [
  body('password').isLength({ min: 6 })
], resetPassword);

// @route   GET /api/auth/reset-password/:token
// @access  Public
router.get('/reset-password/:token', validateResetToken);

module.exports = router;








