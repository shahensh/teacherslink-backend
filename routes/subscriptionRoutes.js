const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createOrder,
  verifyPayment,
  getSubscriptionStatus,
} = require('../controllers/subscriptionController');

router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/status', protect, getSubscriptionStatus);

module.exports = router;
