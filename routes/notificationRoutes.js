const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  createNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// @route   GET /api/notifications
// @access  Private (Teacher, School, Admin)
router.get('/', getNotifications);

// @route   GET /api/notifications/unread-count
// @access  Private (Teacher, School, Admin)
router.get('/unread-count', getUnreadCount);

// @route   PUT /api/notifications/:id/read
// @access  Private (Teacher, School, Admin)
router.put('/:id/read', markAsRead);

// @route   PUT /api/notifications/read-all
// @access  Private (Teacher, School, Admin)
router.put('/read-all', markAllAsRead);

// @route   DELETE /api/notifications/:id
// @access  Private (Teacher, School, Admin)
router.delete('/:id', deleteNotification);

// @route   POST /api/notifications/create
// @access  Private (School, Admin) - For creating notifications
router.post('/create', authorize('school', 'admin'), createNotification);

module.exports = router;



