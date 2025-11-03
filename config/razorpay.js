const Razorpay = require('razorpay');

// Check if Razorpay credentials are configured
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️ Razorpay credentials not configured. Payment features will be disabled.');
  module.exports = null;
} else {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log('✅ Razorpay initialized successfully');
  module.exports = razorpay;
}
