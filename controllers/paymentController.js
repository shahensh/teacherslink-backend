const Razorpay = require('razorpay');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Plan = require('../models/Plan');
const School = require('../models/School'); // adapt path/name to your model

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order for one-time plan purchase
exports.createOrder = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const userId = req.user.id; // authenticated school
  if (!planId) { res.status(400); throw new Error('planId required'); }

  const plan = await Plan.findById(planId);
  if (!plan || !plan.active) { res.status(404); throw new Error('Plan not found'); }

  const amountPaise = Math.round(plan.price * 100);

  // Generate a short receipt ID (max 40 chars for Razorpay)
  // Format: S + last 10 digits of timestamp + last 4 chars of userId
  const timestamp = Date.now().toString().slice(-10);
  const shortUserId = userId.toString().slice(-4);
  const shortReceipt = `S${timestamp}${shortUserId}`;

  const orderOptions = {
    amount: amountPaise,
    currency: 'INR',
    receipt: shortReceipt,
    notes: { planId: plan._id.toString(), schoolId: userId }
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

// Verify payment sent from frontend handler and activate plan immediately
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400); throw new Error('Invalid payment data');
  }

  const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (generated_signature !== razorpay_signature) {
    res.status(400); throw new Error('Payment verification failed');
  }

  // Fetch order to get notes
  const order = await razorpay.orders.fetch(razorpay_order_id).catch(()=>null);
  if (!order) {
    res.status(404); throw new Error('Order not found');
  }

  const planId = order.notes && order.notes.planId;
  const schoolId = order.notes && order.notes.schoolId;
  if (!planId || !schoolId) {
    // fallback: use req.user
  }

  const plan = await Plan.findById(planId);
  const school = await School.findById(schoolId || req.user.id);
  if (!plan || !school) {
    res.status(404); throw new Error('Related plan or school missing');
  }

  // activate plan for the school
  const activatedAt = new Date();
  const expiresAt = new Date(activatedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  school.plan = {
    planId: plan._id,
    title: plan.title,
    activatedAt,
    expiresAt,
    isPremium: true
  };
  await school.save();

  res.json({ success: true, message: 'Plan activated', plan: school.plan });
});

// Webhook endpoint (automatic activation via Razorpay webhook)
// Configure this URL in Razorpay dashboard and set RAZORPAY_WEBHOOK_SECRET
exports.webhookHandler = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const payload = JSON.stringify(req.body);
  const sig = req.headers['x-razorpay-signature'];

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (expected !== sig) {
    return res.status(400).json({ ok: false, msg: 'Invalid webhook signature' });
  }

  // Example: payment.captured
  const event = req.body.event;
  if (event === 'payment.captured') {
    const payment = req.body.payload.payment.entity;
    // find the order and notes
    const orderId = payment.order_id;
    const order = await razorpay.orders.fetch(orderId).catch(()=>null);
    if (order) {
      const planId = order.notes && order.notes.planId;
      const schoolId = order.notes && order.notes.schoolId;
      const plan = await Plan.findById(planId);
      const SchoolModel = require('../models/School');
      const school = await SchoolModel.findById(schoolId);
      if (plan && school) {
        const activatedAt = new Date();
        const expiresAt = new Date(activatedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
        school.plan = {
          planId: plan._id,
          title: plan.title,
          activatedAt,
          expiresAt,
          isPremium: true
        };
        await school.save();
      }
    }
  }

  res.json({ ok: true });
});
