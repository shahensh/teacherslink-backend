const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getConversations,
  markMessageAsRead,
  deleteMessage,
  getUnreadCount,
  deleteConversation
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

// All routes are protected
router.use(protect);

// @route   POST /api/chat/messages
// @access  Private
router.post('/messages', [
  body('applicationId').isMongoId(),
  body('message').trim().isLength({ min: 1 }),
  body('messageType').optional().isIn(['text', 'file', 'image', 'system']),
  body('attachments').optional().isArray()
], sendMessage);

// @route   GET /api/chat/messages/:applicationId
// @access  Private
router.get('/messages/:applicationId', getMessages);

// @route   GET /api/chat/conversations
// @access  Private
router.get('/conversations', getConversations);

// @route   PUT /api/chat/messages/:messageId/read
// @access  Private
router.put('/messages/:messageId/read', markMessageAsRead);

// @route   DELETE /api/chat/messages/:messageId
// @access  Private
router.delete('/messages/:messageId', deleteMessage);

// @route   GET /api/chat/unread-count
// @access  Private
router.get('/unread-count', getUnreadCount);

// @route   DELETE /api/chat/conversations/:applicationId
// @access  Private
router.delete('/conversations/:applicationId', deleteConversation);

module.exports = router;








