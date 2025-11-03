const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const JobTemplate = require('../models/JobTemplate');
const JobApplication = require('../models/JobApplication');
const JobAnalytics = require('../models/JobAnalytics');
const School = require('../models/School');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (School/Admin)
const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    department,
    employmentType,
    startDate,
    applicationDeadline,
    description,
    responsibilities,
    requirements,
    salary,
    benefits,
    perks,
    location,
    schedule,
    applicationProcess,
    tags,
    urgent,
    internalNotes
  } = req.body;

  console.log('📍 Creating job with location:', location);

  // Get school information
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Create job
  const job = await Job.create({
    title,
    department,
    employmentType,
    startDate,
    applicationDeadline,
    description,
    responsibilities,
    requirements,
    salary,
    benefits,
    perks,
    location: {
      ...location,
      // Use job-specific location if provided, otherwise fall back to school address
      address: location?.address || school.address.street,
      city: location?.city || school.address.city,
      state: location?.state || school.address.state,
      country: location?.country || school.address.country || 'India',
      zipCode: location?.zipCode || school.address.pincode
    },
    schedule,
    applicationProcess,
    tags,
    urgent,
    internalNotes,
    school: school._id,
    postedBy: req.user.id
  });

  console.log('✅ Job created with location:', job.location);

  // Create analytics record
  await JobAnalytics.create({
    job: job._id,
    school: school._id
  });

  // Emit socket event for real-time updates
  if (global.jobSocketEmitters) {
    await global.jobSocketEmitters.emitJobCreated(job);
  }

  // Emit stats update for home page
  if (global.io) {
    const activeJobs = await Job.countDocuments({ status: 'active' });
    global.io.emit('stats_updated', { activeJobs });
  }

  // Create notifications for all teachers
  try {
    const teachers = await User.find({ role: 'teacher' }).select('_id');
    const notifications = teachers.map(teacher => ({
      user: teacher._id,
      type: 'job_posted',
      title: 'New Job Posted',
      message: `${school.schoolName} posted a new job: ${title}`,
      data: {
        jobId: job._id,
        schoolId: school._id,
        schoolName: school.schoolName,
        jobTitle: title
      }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      
      // Emit socket event to all teachers
      if (global.io) {
        teachers.forEach(teacher => {
          global.io.to(`user_${teacher._id}`).emit('new_notification', {
            type: 'job_posted',
            title: 'New Job Posted',
            message: `${school.schoolName} posted a new job: ${title}`,
            data: {
              jobId: job._id,
              schoolId: school._id,
              schoolName: school.schoolName,
              jobTitle: title
            },
            timestamp: new Date()
          });
        });
      }
      
      console.log(`✅ Created ${notifications.length} job notifications for teachers`);
    }
  } catch (error) {
    console.error('Error creating job notifications:', error);
    // Don't fail the job creation if notification fails
  }

  res.status(201).json({
    success: true,
    message: 'Job created successfully',
    data: job
  });
});

// @desc    Get all jobs with filtering and pagination
// @route   GET /api/jobs
// @access  Public
const getJobs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    department,
    employmentType,
    location,
    salaryMin,
    salaryMax,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter object
  const filter = {
    status: 'active',
    isActive: true,
    expiresAt: { $gt: new Date() }
  };

  // Add search filter
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Add department filter
  if (department) {
    filter.department = department;
  }

  // Add employment type filter
  if (employmentType) {
    filter.employmentType = employmentType;
  }

  // Add location filter
  if (location) {
    filter['location.city'] = { $regex: location, $options: 'i' };
  }

  // Add salary filter
  if (salaryMin || salaryMax) {
    filter['salary.min'] = {};
    if (salaryMin) filter['salary.min'].$gte = parseInt(salaryMin);
    if (salaryMax) filter['salary.max'] = { $lte: parseInt(salaryMax) };
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Execute query
  const jobs = await Job.find(filter)
    .populate('school', 'schoolName address contactInfo')
    .populate('postedBy', 'email')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Job.countDocuments(filter);

  res.json({
    success: true,
    data: jobs,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      limit: parseInt(limit)
    }
  });
});

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate('school', 'schoolName address contactInfo description')
    .populate('postedBy', 'email role');

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Increment views
  await job.incrementViews();
  
  // Update analytics
  const analytics = await JobAnalytics.findOne({ job: job._id });
  if (analytics) {
    await analytics.incrementViews();
  }

  // Emit realtime event for views update
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('job_viewed', { jobId: job._id });
    }
  } catch (e) {}

  res.json({
    success: true,
    data: job
  });
});

// @desc    Update job posting
// @route   PUT /api/jobs/:id
// @access  Private (School/Admin)
const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if user owns the job or is admin
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this job'
    });
  }

  console.log('📍 Updating job with location:', req.body.location);

  // Get school information for fallback
  const school = await School.findOne({ user: req.user.id });

  // Update location with proper fallback
  if (req.body.location) {
    req.body.location = {
      ...req.body.location,
      city: req.body.location.city || req.body.city || school?.address?.city || '',
      state: req.body.location.state || req.body.state || school?.address?.state || '',
      country: req.body.location.country || school?.address?.country || 'India',
      zipCode: req.body.location.zipCode || school?.address?.pincode || '',
      address: req.body.location.address || school?.address?.street || ''
    };
  }

  const updatedJob = await Job.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('school', 'schoolName address contactInfo');

  console.log('✅ Job updated with location:', updatedJob.location);

  // Emit socket event for real-time updates
  if (global.jobSocketEmitters) {
    await global.jobSocketEmitters.emitJobUpdated(updatedJob);
  }

  res.json({
    success: true,
    message: 'Job updated successfully',
    data: updatedJob
  });
});

// @desc    Delete job posting
// @route   DELETE /api/jobs/:id
// @access  Private (School/Admin)
const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if user owns the job or is admin
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this job'
    });
  }

  // Delete related data
  await JobApplication.deleteMany({ job: job._id });
  await JobAnalytics.deleteOne({ job: job._id });
  await Job.findByIdAndDelete(req.params.id);

  // Emit socket event for real-time updates
  if (global.jobSocketEmitters) {
    global.jobSocketEmitters.emitJobDeleted(req.params.id);
  }

  res.json({
    success: true,
    message: 'Job deleted successfully'
  });
});

// @desc    Publish job posting
// @route   POST /api/jobs/:id/publish
// @access  Private (School/Admin)
const publishJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if user owns the job or is admin
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to publish this job'
    });
  }

  job.status = 'active';
  job.isActive = true;
  await job.save();

  res.json({
    success: true,
    message: 'Job published successfully',
    data: job
  });
});

// @desc    Pause job posting
// @route   POST /api/jobs/:id/pause
// @access  Private (School/Admin)
const pauseJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if user owns the job or is admin
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to pause this job'
    });
  }

  job.status = 'paused';
  job.isActive = false;
  await job.save();

  res.json({
    success: true,
    message: 'Job paused successfully',
    data: job
  });
});

// @desc    Get jobs by school
// @route   GET /api/jobs/school/:schoolId
// @access  Public
const getJobsBySchool = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  
  const filter = { school: req.params.schoolId };
  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const jobs = await Job.find(filter)
    .populate('school', 'schoolName address contactInfo')
    .populate('postedBy', 'email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(filter);

  res.json({
    success: true,
    data: jobs,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      limit: parseInt(limit)
    }
  });
});

// @desc    Get user's job postings
// @route   GET /api/jobs/my-jobs
// @access  Private
const getMyJobs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  
  const filter = { postedBy: req.user.id };
  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const jobs = await Job.find(filter)
    .populate('school', 'schoolName address contactInfo')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(filter);

  res.json({
    success: true,
    data: jobs,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      limit: parseInt(limit)
    }
  });
});

// @desc    Get featured jobs
// @route   GET /api/jobs/featured
// @access  Public
const getFeaturedJobs = asyncHandler(async (req, res) => {
  const { limit = 6 } = req.query;

  const jobs = await Job.find({
    status: 'active',
    isActive: true,
    isFeatured: true,
    expiresAt: { $gt: new Date() }
  })
    .populate('school', 'schoolName address contactInfo')
    .populate('postedBy', 'email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: jobs
  });
});

// @desc    Search jobs
// @route   GET /api/jobs/search
// @access  Public
const searchJobs = asyncHandler(async (req, res) => {
  const {
    q,
    location,
    department,
    employmentType,
    page = 1,
    limit = 10
  } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const filter = {
    status: 'active',
    isActive: true,
    expiresAt: { $gt: new Date() },
    $text: { $search: q }
  };

  if (location) {
    filter['location.city'] = { $regex: location, $options: 'i' };
  }

  if (department) {
    filter.department = department;
  }

  if (employmentType) {
    filter.employmentType = employmentType;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const jobs = await Job.find(filter, { score: { $meta: 'textScore' } })
    .populate('school', 'schoolName address contactInfo')
    .populate('postedBy', 'email')
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(filter);

  res.json({
    success: true,
    data: jobs,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      limit: parseInt(limit)
    }
  });
});

module.exports = {
  createJob,
  getJobs,
  getJob,
  updateJob,
  deleteJob,
  publishJob,
  pauseJob,
  getJobsBySchool,
  getMyJobs,
  getFeaturedJobs,
  searchJobs
};