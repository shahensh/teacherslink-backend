const mongoose = require('mongoose');
const School = require('../models/School');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { asyncHandler } = require('../middleware/errorMiddleware');
const SchoolPost = require('../models/SchoolPost');
const { uploadToCloudinary } = require('../utils/upload');
const { moderateImage, getModerationErrorMessage } = require('../services/imageModeration');
const cloudinary = require('cloudinary').v2;

// @desc    Get school profile
// @route   GET /api/schools/profile
// @access  Private (School)
const getSchoolProfile = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id })
    .populate('user', 'email isVerified plan')
    .populate('reviews.teacher', 'personalInfo.firstName personalInfo.lastName');

  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Add plan information to school object
  if (school.user && school.user.plan) {
    school.plan = school.user.plan;
  }

  res.json({
    success: true,
    school
  });
});

// Get school profile by ID (for viewing other schools' profiles)
const getSchoolProfileById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('Looking for school with ID/slug:', id);
  
  let school = null;
  
  // First try to find by slug (if it's not a valid ObjectId)
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log('ID is not a valid ObjectId, searching by slug');
    school = await School.findOne({ slug: id })
      .populate('user', 'email isVerified plan')
      .populate('reviews.teacher', 'personalInfo.firstName personalInfo.lastName');
  } else {
    console.log('ID is a valid ObjectId, searching by _id');
    school = await School.findById(id)
      .populate('user', 'email isVerified plan')
      .populate('reviews.teacher', 'personalInfo.firstName personalInfo.lastName');
  }
  
  // If not found by the above methods, try the original $or query as fallback
  if (!school) {
    console.log('Not found by primary method, trying $or query');
    school = await School.findOne({
      $or: [
        { _id: id },
        { slug: id }
      ]
    })
      .populate('user', 'email isVerified')
      .populate('reviews.teacher', 'personalInfo.firstName personalInfo.lastName');
  }

  console.log('Found school:', school ? 'Yes' : 'No');
  if (school) {
    console.log('School ID:', school._id);
    console.log('School slug:', school.slug);
  }

  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Add plan information to school object
  if (school.user && school.user.plan) {
    school.plan = school.user.plan;
  }

  res.json({
    success: true,
    school
  });
});

// @desc    Update school profile
// @route   PUT /api/schools/profile
// @access  Private (School)
const updateSchoolProfile = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });

  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Handle custom username/slug
  if (req.body.slug) {
    const customSlug = req.body.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/(^-|-$)/g, '');
    
    // Validate slug format
    if (customSlug.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long'
      });
    }
    
    if (customSlug.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username must be less than 30 characters'
      });
    }
    
    // Check if slug is already taken by another school
    const existingSchool = await School.findOne({ 
      slug: customSlug, 
      _id: { $ne: school._id } 
    });
    
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken. Please choose a different one.'
      });
    }
    
    school.slug = customSlug;
  } else if (!school.slug && (req.body.schoolName || school.schoolName)) {
    // Auto-generate slug if not provided and not set
    const base = (req.body.schoolName || school.schoolName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    school.slug = `${base}-${school._id.toString().slice(-5)}`;
  }

  // Update fields
  Object.keys(req.body).forEach(key => {
    if (req.body[key] !== undefined) {
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        if (!school[parent]) school[parent] = {};
        school[parent][child] = req.body[key];
      } else {
        school[key] = req.body[key];
      }
    }
  });

  await school.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    school
  });
});

// @desc    Upload profile image
// @route   POST /api/schools/upload-profile-image
// @access  Private (School)
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  try {
    const result = await uploadToCloudinary(req.file, 'schools/profile-images');
    console.log('✅ School image uploaded to Cloudinary');

    // Moderate image (with error handling)
    try {
      const moderationResult = await moderateImage(result.secure_url);
      if (!moderationResult.skipped && moderationResult.isInappropriate) {
        await cloudinary.uploader.destroy(result.public_id);
        return res.status(400).json({
          success: false,
          message: getModerationErrorMessage(moderationResult)
        });
      }
    } catch (moderationError) {
      console.error('⚠️ Image moderation failed, but allowing upload:', moderationError.message);
      // Don't block the upload if moderation fails
    }

    school.profileImage = result.secure_url;
    await school.save();

    console.log('💾 Saved profileImage to database:', school.profileImage);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('image_uploaded', {
        type: 'image_uploaded',
        imageType: 'profile',
        url: result.secure_url,
        userId: req.user.id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: result.secure_url
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image'
    });
  }
});

// @desc    Upload cover image
// @route   POST /api/schools/upload-cover-image
// @access  Private (School)
const uploadCoverImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  try {
    const result = await uploadToCloudinary(req.file, 'schools/cover-images');
    console.log('✅ School cover uploaded to Cloudinary');

    // Moderate image (with error handling)
    try {
      const moderationResult = await moderateImage(result.secure_url);
      if (!moderationResult.skipped && moderationResult.isInappropriate) {
        await cloudinary.uploader.destroy(result.public_id);
        return res.status(400).json({
          success: false,
          message: getModerationErrorMessage(moderationResult)
        });
      }
    } catch (moderationError) {
      console.error('⚠️ Image moderation failed, but allowing upload:', moderationError.message);
      // Don't block the upload if moderation fails
    }

    school.coverImage = result.secure_url;
    await school.save();

    console.log('💾 Saved coverImage to database:', school.coverImage);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('image_uploaded', {
        type: 'image_uploaded',
        imageType: 'cover',
        url: result.secure_url,
        userId: req.user.id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Cover image uploaded successfully',
      coverImage: result.secure_url
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload cover image'
    });
  }
});

// @desc    Upload school photos
// @route   POST /api/schools/upload-photos
// @access  Private (School)
const uploadPhotos = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded'
    });
  }

  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  const uploadedPhotos = [];
  for (const file of req.files) {
    try {
      // Upload to Cloudinary
      const result = await uploadToCloudinary(file, 'schools/photos');
      
      // Moderate the image
      console.log('🔍 Moderating school gallery photo:', result.secure_url);
      const moderationResult = await moderateImage(result.secure_url);
      
      if (!moderationResult.skipped && moderationResult.isInappropriate) {
        console.log('❌ Inappropriate content detected in school photo:', moderationResult.detectedLabels);
        
        // Delete the image from Cloudinary
        try {
          await cloudinary.uploader.destroy(result.public_id);
          console.log('🗑️ Deleted inappropriate school photo from Cloudinary');
        } catch (deleteError) {
          console.error('Error deleting image:', deleteError);
        }
        
        // Return error to user
        const errorMessage = getModerationErrorMessage(moderationResult);
        return res.status(400).json({
          success: false,
          message: errorMessage,
          moderationDetails: {
            detectedContent: moderationResult.detectedLabels.map(l => l.name)
          }
        });
      }
      
      console.log('✅ School gallery photo passed moderation');
      uploadedPhotos.push(result.secure_url);
    } catch (error) {
      console.error('Upload error:', error);
    }
  }

  school.photos = [...school.photos, ...uploadedPhotos];
  await school.save();

  res.json({
    success: true,
    message: 'Photos uploaded successfully',
    photos: uploadedPhotos
  });
});

// @desc    Post a job
// @route   POST /api/schools/jobs
// @access  Private (School)
const postJob = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  const jobData = {
    ...req.body,
    school: school._id
  };

  const job = await Job.create(jobData);

  res.status(201).json({
    success: true,
    message: 'Job posted successfully',
    job
  });
});

// @desc    Get school's jobs
// @route   GET /api/schools/jobs
// @access  Private (School)
const getSchoolJobs = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  const jobs = await Job.find({ school: school._id })
    .sort({ createdAt: -1 })
    .populate('school', 'schoolName');

  res.json({
    success: true,
    jobs
  });
});

// @desc    Get job applications
// @route   GET /api/schools/jobs/:jobId/applications
// @access  Private (School)
const getJobApplications = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  const job = await Job.findOne({ _id: req.params.jobId, school: school._id });
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  const applications = await Application.find({ job: job._id })
    .populate('teacher', 'personalInfo professionalInfo')
    .sort({ applicationDate: -1 });

  res.json({
    success: true,
    applications
  });
});

// @desc    Update application status
// @route   PUT /api/schools/applications/:applicationId/status
// @access  Private (School)
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, reviewNotes } = req.body;

  const application = await Application.findById(req.params.applicationId)
    .populate('job', 'school')
    .populate('teacher', 'personalInfo');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  // Check if school owns this job
  const school = await School.findOne({ user: req.user.id });
  if (application.job.school.toString() !== school._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this application'
    });
  }

  application.status = status;
  if (reviewNotes) application.reviewNotes = reviewNotes;
  application.reviewDate = new Date();

  await application.save();

  res.json({
    success: true,
    message: 'Application status updated successfully',
    application
  });
});

// @desc    Schedule interview
// @route   POST /api/schools/applications/:applicationId/interview
// @access  Private (School)
const scheduleInterview = asyncHandler(async (req, res) => {
  const { scheduledDate, interviewType, location, meetingLink, interviewer, notes } = req.body;

  const application = await Application.findById(req.params.applicationId)
    .populate('job', 'school');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  // Check if school owns this job
  const school = await School.findOne({ user: req.user.id });
  if (application.job.school.toString() !== school._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to schedule interview for this application'
    });
  }

  application.interviewSchedule = {
    scheduledDate,
    interviewType,
    location,
    meetingLink,
    interviewer,
    notes,
    status: 'scheduled'
  };

  await application.save();

  res.json({
    success: true,
    message: 'Interview scheduled successfully',
    application
  });
});

// @desc    Add achievement
// @route   POST /api/schools/achievements
// @access  Private (School)
const addAchievement = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  const achievement = {
    title: req.body.title,
    description: req.body.description,
    date: req.body.date || new Date(),
    image: req.body.image
  };

  school.achievements.push(achievement);
  await school.save();

  res.status(201).json({
    success: true,
    message: 'Achievement added successfully',
    achievement
  });
});

// @desc    Check username availability
// @route   GET /api/schools/check-username/:username
// @access  Private (School)
const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { username } = req.params;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required'
    });
  }
  
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/(^-|-$)/g, '');
  
  // Validate format
  if (cleanUsername.length < 3) {
    return res.json({
      success: true,
      available: false,
      message: 'Username must be at least 3 characters long'
    });
  }
  
  if (cleanUsername.length > 30) {
    return res.json({
      success: true,
      available: false,
      message: 'Username must be less than 30 characters'
    });
  }
  
  // Check if username is taken
  const existingSchool = await School.findOne({ slug: cleanUsername });
  
  res.json({
    success: true,
    available: !existingSchool,
    username: cleanUsername,
    message: existingSchool ? 'Username is already taken' : 'Username is available'
  });
});

module.exports = {
  getSchoolProfile,
  getSchoolProfileById,
  updateSchoolProfile,
  uploadProfileImage,
  uploadCoverImage,
  uploadPhotos,
  postJob,
  getSchoolJobs,
  getJobApplications,
  updateApplicationStatus,
  scheduleInterview,
  addAchievement,
  checkUsernameAvailability
};








