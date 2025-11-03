const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  moderatePost,
  getModerationStats
} = require('../controllers/contentModerationController');

// Moderate post content
router.post('/moderate', protect, moderatePost);

// Get moderation statistics (admin only)
router.get('/stats', protect, authorize('admin'), getModerationStats);

module.exports = router;
