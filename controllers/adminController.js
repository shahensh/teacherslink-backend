const User = require('../models/User');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Message = require('../models/Message');
const TeacherSubscription = require('../models/TeacherSubscription');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const { asyncHandler } = require('../middleware/errorMiddleware');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getDashboardStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalSchools = await School.countDocuments();
  const totalTeachers = await Teacher.countDocuments();
  const totalJobs = await Job.countDocuments();
  const activeJobs = await Job.countDocuments({ isActive: true });
  const totalApplications = await Application.countDocuments();

  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('email role createdAt');

  const recentJobs = await Job.find()
    .populate('school', 'schoolName')
    .sort({ createdAt: -1 })
    .limit(5);

  const pendingVerifications = await School.countDocuments({ isVerified: false });

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalSchools,
      totalTeachers,
      totalJobs,
      activeJobs,
      totalApplications,
      pendingVerifications
    },
    recent: {
      users: recentUsers,
      jobs: recentJobs
    }
  });
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
const getAllUsers = asyncHandler(async (req, res) => {
  const {
    role,
    isVerified,
    isActive,
    search,
    page = 1,
    limit = 10
  } = req.query;

  const query = {};
  if (role) query.role = role;
  if (isVerified !== undefined) query.isVerified = isVerified === 'true';
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  // Add search functionality
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin)
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  let profile = null;
  if (user.role === 'school') {
    profile = await School.findOne({ user: user._id });
  } else if (user.role === 'teacher') {
    profile = await Teacher.findOne({ user: user._id });
  }

  res.json({
    success: true,
    user,
    profile
  });
});

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive, isVerified } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (isActive !== undefined) user.isActive = isActive;
  if (isVerified !== undefined) user.isVerified = isVerified;

  await user.save();

  res.json({
    success: true,
    message: 'User status updated successfully',
    user
  });
});

// @desc    Verify school
// @route   PUT /api/admin/schools/:id/verify
// @access  Private (Admin)
const verifySchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School not found'
    });
  }

  school.isVerified = true;
  await school.save();

  // Update user verification status
  await User.findByIdAndUpdate(school.user, { isVerified: true });

  // Emit real-time event for admin dashboard
  if (global.io) {
    global.io.emit('school_verified', {
      _id: school._id,
      schoolName: school.schoolName,
      isVerified: true,
      verifiedAt: new Date()
    });
    console.log('Emitted school_verified event:', school.schoolName);
  }

  res.json({
    success: true,
    message: 'School verified successfully',
    school
  });
});

// @desc    Get pending verifications
// @route   GET /api/admin/verifications
// @access  Private (Admin)
const getPendingVerifications = asyncHandler(async (req, res) => {
  const schools = await School.find({ isVerified: false })
    .populate('user', 'email createdAt')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    schools
  });
});

// @desc    Get all jobs (admin view)
// @route   GET /api/admin/jobs
// @access  Private (Admin)
const getAllJobsAdmin = asyncHandler(async (req, res) => {
  const {
    isActive,
    school,
    page = 1,
    limit = 10
  } = req.query;

  const query = {};
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (school) query.school = school;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const jobs = await Job.find(query)
    .populate({
      path: 'school',
      select: 'schoolName contactEmail contactName'
    })
    .populate({
      path: 'postedBy',
      select: 'email username'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(query);

  res.json({
    success: true,
    jobs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Update job status
// @route   PUT /api/admin/jobs/:id/status
// @access  Private (Admin)
const updateJobStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const job = await Job.findById(req.params.id);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  job.isActive = isActive;
  await job.save();

  res.json({
    success: true,
    message: 'Job status updated successfully',
    job
  });
});

// @desc    Get all applications
// @route   GET /api/admin/applications
// @access  Private (Admin)
const getAllApplications = asyncHandler(async (req, res) => {
  const {
    status,
    job,
    teacher,
    page = 1,
    limit = 10
  } = req.query;

  const query = {};
  if (status) query.status = status;
  if (job) query.job = job;
  if (teacher) query.teacher = teacher;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const applications = await Application.find(query)
    .populate('job', 'title')
    .populate('teacher', 'personalInfo.firstName personalInfo.lastName')
    .populate('school', 'schoolName')
    .sort({ applicationDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Application.countDocuments(query);

  res.json({
    success: true,
    applications,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get system analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin)
const getSystemAnalytics = asyncHandler(async (req, res) => {
  const { period = '30' } = req.query;
  const days = parseInt(period);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // User registrations over time
  const userRegistrations = await User.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Job postings over time
  const jobPostings = await Job.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Applications over time
  const applications = await Application.aggregate([
    { $match: { applicationDate: { $gte: startDate } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$applicationDate' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Top subjects
  const topSubjects = await Job.aggregate([
    { $group: { _id: '$jobDetails.subject', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Top locations
  const topLocations = await Job.aggregate([
    { $group: { _id: '$location.city', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    success: true,
    analytics: {
      userRegistrations,
      jobPostings,
      applications,
      topSubjects,
      topLocations
    }
  });
});

// @desc    Get all teachers with subscription data
// @route   GET /api/admin/teachers
// @access  Private (Admin)
const getTeachersWithSubscriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status = '', plan = '' } = req.query;
  
  // Build filter object
  const filter = { role: 'teacher' };
  
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  // Get teachers with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const teachers = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-password');

  // Get subscription data for each teacher
  const teachersWithSubscriptions = await Promise.all(
    teachers.map(async (teacher) => {
      // Get teacher profile
      const teacherProfile = await Teacher.findOne({ user: teacher._id });
      
      // Get active subscription
      const activeSubscription = await TeacherSubscription.findOne({
        teacher: teacher._id,
        status: 'active'
      }).sort({ createdAt: -1 });

      // Get plan details if subscription exists
      let planDetails = null;
      if (activeSubscription) {
        planDetails = await Plan.findOne({ title: activeSubscription.planName });
      }

      // Get user's plan info from User model
      const userPlanInfo = teacher.plan || {};

      return {
        ...teacher.toObject(),
        teacherProfile,
        subscription: activeSubscription,
        planDetails,
        userPlanInfo,
        isPremium: userPlanInfo.isPremium || false,
        planExpiresAt: userPlanInfo.expiresAt,
        planTitle: userPlanInfo.title || 'Free'
      };
    })
  );

  // Apply additional filters
  let filteredTeachers = teachersWithSubscriptions;
  
  if (status === 'premium') {
    filteredTeachers = filteredTeachers.filter(t => t.isPremium);
  } else if (status === 'free') {
    filteredTeachers = filteredTeachers.filter(t => !t.isPremium);
  }
  
  if (plan) {
    filteredTeachers = filteredTeachers.filter(t => 
      t.planTitle.toLowerCase().includes(plan.toLowerCase())
    );
  }

  // Get total count for pagination
  const total = await User.countDocuments(filter);
  
  res.json({
    success: true,
    teachers: filteredTeachers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get all schools with subscription data
// @route   GET /api/admin/schools
// @access  Private (Admin)
const getSchoolsWithSubscriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status = '', plan = '' } = req.query;
  
  // Build filter object
  const filter = { role: 'school' };
  
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  // Get schools with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const schools = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-password');

  // Get subscription data for each school
  const schoolsWithSubscriptions = await Promise.all(
    schools.map(async (school) => {
      // Get school profile
      const schoolProfile = await School.findOne({ user: school._id });
      
      // Get active subscription
      const activeSubscription = await Subscription.findOne({
        school: school._id,
        status: 'active'
      }).sort({ createdAt: -1 });

      // Get plan details if subscription exists
      let planDetails = null;
      if (activeSubscription) {
        planDetails = await Plan.findOne({ title: activeSubscription.planName });
      }

      // Get user's plan info from User model
      const userPlanInfo = school.plan || {};

      return {
        ...school.toObject(),
        schoolProfile,
        subscription: activeSubscription,
        planDetails,
        userPlanInfo,
        isPremium: userPlanInfo.isPremium || false,
        planExpiresAt: userPlanInfo.expiresAt,
        planTitle: userPlanInfo.title || 'Free'
      };
    })
  );

  // Apply additional filters
  let filteredSchools = schoolsWithSubscriptions;
  
  if (status === 'premium') {
    filteredSchools = filteredSchools.filter(s => s.isPremium);
  } else if (status === 'free') {
    filteredSchools = filteredSchools.filter(s => !s.isPremium);
  }
  
  if (plan) {
    filteredSchools = filteredSchools.filter(s => 
      s.planTitle.toLowerCase().includes(plan.toLowerCase())
    );
  }

  // Get total count for pagination
  const total = await User.countDocuments(filter);
  
  res.json({
    success: true,
    schools: filteredSchools,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  verifySchool,
  getPendingVerifications,
  getAllJobsAdmin,
  updateJobStatus,
  getAllApplications,
  getSystemAnalytics,
  getTeachersWithSubscriptions,
  getSchoolsWithSubscriptions
};








