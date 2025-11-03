const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, webhookHandler } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const expressRaw = require('express').raw;

// authenticated schools create orders
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

// webhook - should be raw body
router.post('/webhook', expressRaw({ type: '*/*' }), webhookHandler);

module.exports = router;
