const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const TeacherSubscription = require('../models/TeacherSubscription');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc   Create order for teacher subscription
// @route  POST /api/teacher-subscription/create-order
// @access Private (teacher)
const createOrder = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const userId = req.user.id;

  if (!planId) {
    return res.status(400).json({ message: 'Plan ID is required' });
  }

  // Verify user is a teacher
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can create teacher subscriptions' });
  }

  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive || plan.userType !== 'teacher') {
    return res.status(404).json({ message: 'Plan not found or not available for teachers' });
  }

  // Handle FREE plan (no payment needed)
  if (plan.price === 0 || plan.title.toLowerCase().includes('free')) {
    console.log('Free plan detected for teacher, activating directly');
    
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (plan.durationMonths || 12));

    // Check for existing subscription
    let subscription = await TeacherSubscription.findOne({ teacher: userId });

    if (subscription) {
      // Update existing subscription
      subscription.plan = {
        planId: plan._id,
        title: plan.title,
        price: plan.price,
        features: plan.features
      };
      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.expiryDate = expiryDate;
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await TeacherSubscription.create({
        teacher: userId,
        plan: {
          planId: plan._id,
          title: plan.title,
          price: plan.price,
          features: plan.features
        },
        status: 'active',
        startDate,
        expiryDate
      });
    }

    // Update user's plan info (use correct field names for status check)
    await User.findByIdAndUpdate(userId, {
      'plan.planId': plan._id,
      'plan.title': plan.title,
      'plan.activatedAt': startDate,
      'plan.expiryDate': expiryDate,
      'plan.expiresAt': expiryDate, // Required for status check
      'plan.isPremium': true // Required for status check
    });

    return res.json({
      success: true,
      message: 'Free plan activated successfully',
      isFree: true,
      subscription
    });
  }

  // Handle PAID plans - create Razorpay order
  const amountPaise = Math.round(plan.price * 100);

  // Generate a short receipt ID (max 40 chars for Razorpay)
  // Format: T + last 10 digits of timestamp + last 6 chars of userId
  const timestamp = Date.now().toString().slice(-10);
  const shortUserId = userId.toString().slice(-6);
  const shortReceipt = `T${timestamp}${shortUserId}`;

  const orderOptions = {
    amount: amountPaise,
    currency: 'INR',
    receipt: shortReceipt,
    notes: { planId: plan._id.toString(), teacherId: userId }
  };

  const order = await razorpay.orders.create(orderOptions);

  res.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.RAZORPAY_KEY_ID,
    plan
  });
});

// @desc   Verify payment and activate teacher subscription
// @route  POST /api/teacher-subscription/verify
// @access Private (teacher)
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName } = req.body;
  const userId = req.user.id;

  console.log('Teacher payment verification request:', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature: razorpay_signature ? 'Present' : 'Missing',
    planName,
    userId
  });

  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
  const digest = hmac.digest('hex');

  console.log('Teacher signature verification:', {
    generated: digest,
    received: razorpay_signature,
    match: digest === razorpay_signature
  });

  if (digest !== razorpay_signature) {
    console.log('Teacher payment verification failed: Invalid signature');
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // Payment verified — activate subscription
  // Get the plan details to determine subscription duration
  const Plan = require('../models/Plan');
  const plan = await Plan.findOne({ title: planName });
  const durationMonths = plan?.durationMonths || 12; // Default to 12 months if not specified
  
  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

  console.log('Creating teacher subscription:', {
    teacher: userId,
    planName,
    durationMonths,
    status: 'active',
    startDate,
    expiryDate
  });

  const subscription = await TeacherSubscription.create({
    teacher: userId,
    planName,
    status: 'active',
    startDate,
    expiryDate,
  });

  console.log('Teacher subscription created:', subscription._id);

  // Update user plan info
  console.log('Updating teacher user plan info:', {
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
    'isVerified': true, // Auto-verify teacher when they purchase subscription
  });

  console.log('Teacher user plan updated successfully');
  res.json({ success: true, message: 'Teacher subscription activated successfully' });
});

// @desc   Get teacher subscription status
// @route  GET /api/teacher-subscription/status
// @access Private (teacher)
const getTeacherSubscriptionStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId);

  console.log('📋 Checking teacher subscription status for user:', userId);
  console.log('👤 User plan data:', user?.plan);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can access teacher subscription status' });
  }

  // Check teacher's plan directly from User model
  const hasActivePlan = user.plan.isPremium && 
    user.plan.expiresAt && 
    new Date() < new Date(user.plan.expiresAt);
  
  console.log('✅ Has active plan result:', hasActivePlan);
  console.log('📅 Expires at:', user.plan.expiresAt);
  console.log('💎 Is premium:', user.plan.isPremium);
  
  res.json({
    hasActivePlan,
    plan: user.plan.title,
    expiresAt: user.plan.expiresAt,
    isPremium: user.plan.isPremium
  });
});

module.exports = { createOrder, verifyPayment, getTeacherSubscriptionStatus };
