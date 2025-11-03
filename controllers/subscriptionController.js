const asyncHandler = require('express-async-handler');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Plan = require('../models/Plan');


// @desc   Create an order for a selected plan
// @route  POST /api/subscription/create-order
// @access Private (school)
const createOrder = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const userId = req.user.id;

  if (!planId) {
    return res.status(400).json({ message: 'Plan ID is required' });
  }

  const plan = await Plan.findById(planId);

  if (!plan || !plan.isActive || plan.userType !== 'school') {
    return res.status(404).json({ message: "Plan not found or not available for schools" });
  }

  const amountInPaise = Math.round(plan.price * 100); // convert rupees to paise

  // Handle free plans (price = 0) - activate directly without Razorpay
  if (amountInPaise < 100) {
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (plan.durationMonths || 12));

    // Create subscription
    await Subscription.create({
      school: userId,
      planName: plan.title,
      status: 'active',
      startDate,
      expiryDate,
    });

    // Update user plan info
    await User.findByIdAndUpdate(userId, {
      'plan.isPremium': true,
      'plan.planId': planId,
      'plan.title': plan.title,
      'plan.activatedAt': startDate,
      'plan.expiresAt': expiryDate,
      'isVerified': true, // Auto-verify school when they purchase subscription
    });

    return res.json({
      isFree: true,
      success: true,
      message: 'Free plan activated successfully',
      plan
    });
  }

  // For paid plans, create Razorpay order
  
  // Check if Razorpay is configured
  if (!razorpay) {
    console.error('Razorpay is not configured');
    return res.status(500).json({ 
      message: 'Payment gateway is not configured. Please contact the administrator.' 
    });
  }

  try {
    // Generate a short receipt ID (max 40 chars for Razorpay)
    const shortReceipt = `S${Date.now().toString().slice(-10)}${userId.toString().slice(-4)}`;
    
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: shortReceipt,
      notes: { planId: plan._id.toString(), schoolId: userId }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      plan: plan.title
    });
  } catch (error) {
    console.error('Error creating Razorpay order for school:', error);
    const errorMsg = error.message || error.error?.description || 'Unknown error';
    return res.status(500).json({ message: 'Error creating payment order: ' + errorMsg });
  }
});


// @desc   Verify payment and activate subscription
// @route  POST /api/subscription/verify
// @access Private (school)
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName } = req.body;
  const userId = req.user.id;

  console.log('Payment verification request:', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature: razorpay_signature ? 'Present' : 'Missing',
    planName,
    userId
  });

  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
  const digest = hmac.digest('hex');

  console.log('Signature verification:', {
    generated: digest,
    received: razorpay_signature,
    match: digest === razorpay_signature
  });

  if (digest !== razorpay_signature) {
    console.log('Payment verification failed: Invalid signature');
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // Payment verified — activate subscription
  // Get the plan details to determine subscription duration
  const plan = await Plan.findOne({ title: planName });
  const durationMonths = plan?.durationMonths || 12; // Default to 12 months if not specified
  
  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

  console.log('Creating subscription:', {
    school: userId,
    planName,
    durationMonths,
    status: 'active',
    startDate,
    expiryDate
  });

  const subscription = await Subscription.create({
    school: userId,
    planName,
    status: 'active',
    startDate,
    expiryDate,
  });

  console.log('Subscription created:', subscription._id);

  // Update user plan info
  console.log('Updating user plan info:', {
    userId,
    planName,
    durationMonths,
    startDate,
    expiryDate
  });

  await User.findByIdAndUpdate(userId, {
    'plan.isPremium': true,
    'plan.planId': plan?._id || null,
    'plan.title': planName,
    'plan.activatedAt': startDate,
    'plan.expiresAt': expiryDate,
    'isVerified': true, // Auto-verify school when they purchase subscription
  });

  console.log('User plan updated successfully');
  res.json({ success: true, message: 'Subscription activated successfully' });
});


// @desc   Get subscription status for both schools and teachers
const getSubscriptionStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // For teachers, check their plan directly from User model
  if (user.role === 'teacher') {
    const hasActivePlan = user.plan.isPremium && 
      user.plan.expiresAt && 
      new Date() < new Date(user.plan.expiresAt);
    
    return res.json({
      hasActivePlan,
      plan: user.plan.title,
      expiresAt: user.plan.expiresAt,
      isPremium: user.plan.isPremium
    });
  }

  // For schools, check subscription model
  if (user.role === 'school') {
    const subscription = await Subscription.findOne({ school: userId }).sort({ createdAt: -1 });
    if (!subscription) return res.json({ hasActivePlan: false });

    const now = new Date();
    const isActive = subscription.status === 'active' && subscription.expiryDate > now;

    return res.json({
      hasActivePlan: isActive,
      plan: subscription.planName,
      expiresAt: subscription.expiryDate,
    });
  }

  // For other roles, no subscription
  return res.json({ hasActivePlan: false });
});

module.exports = { createOrder, verifyPayment, getSubscriptionStatus };
