const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Job = require('../models/Job');
const Application = require('../models/Application');
const School = require('../models/School');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { uploadToCloudinary } = require('../utils/upload');
const { moderateImage, getModerationErrorMessage } = require('../services/imageModeration');
const cloudinary = require('cloudinary').v2;

// @desc    Get teacher profile
// @route   GET /api/teachers/profile
// @access  Private (Teacher)
const getTeacherProfile = asyncHandler(async (req, res) => {
  let teacher = await Teacher.findOne({ user: req.user.id })
    .populate('user', 'email isVerified plan')
    .populate('reviews.school', 'schoolName');

  if (!teacher) {
    // Create a basic teacher profile if one doesn't exist
    teacher = await Teacher.create({
      user: req.user.id,
      personalInfo: {
        firstName: 'Teacher',
        lastName: 'User',
        phone: '',
        profileImage: '',
        coverImage: ''
      },
      professionalInfo: {
        specialization: [],
        gradeLevels: []
      }
    });
    
    // Populate the newly created teacher
    teacher = await Teacher.findById(teacher._id)
      .populate('user', 'email isVerified plan')
      .populate('reviews.school', 'schoolName');
  }

  res.json({
    success: true,
    teacher
  });
});

// Get teacher profile by ID (for viewing other teachers' profiles)
const getTeacherProfileById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('Looking for teacher with ID/slug:', id);
  
  let teacher = null;
  
  // First try to find by slug (if it's not a valid ObjectId)
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log('ID is not a valid ObjectId, searching by slug');
    teacher = await Teacher.findOne({ slug: id })
      .populate('user', 'email isVerified plan')
      .populate('reviews.school', 'schoolName');
  } else {
    console.log('ID is a valid ObjectId, searching by _id');
    teacher = await Teacher.findById(id)
      .populate('user', 'email isVerified plan')
      .populate('reviews.school', 'schoolName');
  }
  
  // If not found by the above methods, try the original $or query as fallback
  if (!teacher) {
    console.log('Not found by primary method, trying $or query');
    teacher = await Teacher.findOne({
      $or: [
        { _id: id },
        { slug: id }
      ]
    })
      .populate('user', 'email isVerified plan')
      .populate('reviews.school', 'schoolName');
  }

  console.log('Found teacher:', teacher ? 'Yes' : 'No');
  if (teacher) {
    console.log('Teacher ID:', teacher._id);
    console.log('Teacher slug:', teacher.slug);
  }

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  res.json({
    success: true,
    teacher
  });
});

// @desc    Upload profile image
// @route   POST /api/teachers/upload-profile-image
// @access  Private (Teacher)
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  try {
    // Step 1: Upload to Cloudinary
    const result = await uploadToCloudinary(req.file, 'teachers/profile-images');
    console.log('✅ Image uploaded to Cloudinary:', result.secure_url);

    // Step 2: Moderate the image
    console.log('🔍 Starting image moderation...');
    const moderationResult = await moderateImage(result.secure_url);

    // Step 3: Check moderation result
    if (!moderationResult.skipped && moderationResult.isInappropriate) {
      console.log('❌ Inappropriate content detected:', moderationResult.detectedLabels);

      // Delete the image from Cloudinary
      try {
        await cloudinary.uploader.destroy(result.public_id);
        console.log('🗑️ Deleted inappropriate image from Cloudinary');
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

    console.log('✅ Image passed moderation');

    // Step 4: Save to database
    teacher.personalInfo.profilePhoto = result.secure_url;
    teacher.personalInfo.profileImage = result.secure_url; // Also set profileImage field
    await teacher.save();

    // Emit real-time event
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
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// @desc    Upload cover image
// @route   POST /api/teachers/upload-cover-image
// @access  Private (Teacher)
const uploadCoverImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  try {
    // Step 1: Upload to Cloudinary
    const result = await uploadToCloudinary(req.file, 'teachers/cover-images');
    console.log('✅ Cover image uploaded to Cloudinary:', result.secure_url);

    // Step 2: Moderate the image
    console.log('🔍 Starting cover image moderation...');
    const moderationResult = await moderateImage(result.secure_url);

    // Step 3: Check moderation result
    if (!moderationResult.skipped && moderationResult.isInappropriate) {
      console.log('❌ Inappropriate content detected in cover image:', moderationResult.detectedLabels);

      // Delete the image from Cloudinary
      try {
        await cloudinary.uploader.destroy(result.public_id);
        console.log('🗑️ Deleted inappropriate cover image from Cloudinary');
      } catch (deleteError) {
        console.error('Error deleting cover image:', deleteError);
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

    console.log('✅ Cover image passed moderation');

    // Step 4: Save to database
    teacher.personalInfo.coverImage = result.secure_url;
    await teacher.save();

    // Emit real-time event
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

// @desc    Update teacher profile
// @route   PUT /api/teachers/profile
// @access  Private (Teacher)
const updateTeacherProfile = asyncHandler(async (req, res) => {
  console.log('updateTeacherProfile - User ID:', req.user.id);
  console.log('updateTeacherProfile - Request body:', req.body);
  console.log('updateTeacherProfile - Request files:', req.files);
  
  // Debug experience data specifically
  if (req.body['professionalInfo.experience']) {
    console.log('Experience data received:', req.body['professionalInfo.experience']);
    if (Array.isArray(req.body['professionalInfo.experience'])) {
      req.body['professionalInfo.experience'].forEach((exp, index) => {
        console.log(`Experience ${index}:`, exp);
        console.log(`Experience ${index} current field:`, exp.current, 'Type:', typeof exp.current);
      });
    }
  }
  
  const teacher = await Teacher.findOne({ user: req.user.id });

  if (!teacher) {
    console.log('updateTeacherProfile - Teacher profile not found for user:', req.user.id);
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }
  
  console.log('updateTeacherProfile - Found teacher:', teacher._id);

  // ✅ 1. Handle file uploads (profile photo & resume)
  if (req.files) {
    if (req.files.profilePhoto) {
      const uploadedPhoto = await uploadToCloudinary(req.files.profilePhoto[0], 'teachers/profile_photos');
      teacher.personalInfo.profilePhoto = uploadedPhoto.secure_url;
      teacher.personalInfo.profileImage = uploadedPhoto.secure_url; // Also set profileImage for resume compatibility
      console.log('updateTeacherProfile - Profile photo uploaded:', uploadedPhoto.secure_url);
    }
    if (req.files.resume) {
      const uploadedResume = await uploadToCloudinary(req.files.resume[0], 'teachers/resumes');
      teacher.professionalInfo.resume = uploadedResume.secure_url;
    }
  }

  // ✅ 2. Handle custom username/slug
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
    
    // Check if slug is already taken by another teacher
    const existingTeacher = await Teacher.findOne({ 
      slug: customSlug, 
      _id: { $ne: teacher._id } 
    });
    
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken. Please choose a different one.'
      });
    }
    
    teacher.slug = customSlug;
  } else if (!teacher.slug && (req.body.personalInfo?.firstName || teacher.personalInfo?.firstName)) {
    // Auto-generate slug if not provided and not set
    const firstName = req.body.personalInfo?.firstName || teacher.personalInfo?.firstName;
    const lastName = req.body.personalInfo?.lastName || teacher.personalInfo?.lastName;
    const base = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    teacher.slug = `${base}-${teacher._id.toString().slice(-5)}`;
  }

  // ✅ 3. Update all other fields dynamically with proper nested object handling
  Object.keys(req.body).forEach(key => {
    if (req.body[key] !== undefined && key !== 'slug') { // Exclude slug as it's handled above
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = teacher;
        
        // Navigate to the nested object, creating objects as needed
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        
        // Set the final value
        current[parts[parts.length - 1]] = req.body[key];
      } else {
        teacher[key] = req.body[key];
      }
    }
  });

  // ✅ 4. Recalculate total experience if experience is updated
  if (req.body['professionalInfo.experience'] || req.body.professionalInfo?.experience) {
    try {
      // Ensure experience array exists and has valid data
      if (teacher.professionalInfo.experience && Array.isArray(teacher.professionalInfo.experience)) {
        // Filter out invalid experience entries
        const validExperiences = teacher.professionalInfo.experience.filter(exp => 
          exp && exp.startDate && (exp.current || exp.endDate)
        );
        
        if (validExperiences.length > 0) {
          teacher.calculateTotalExperience();
        } else {
          // Set to 0 if no valid experiences
          teacher.professionalInfo.totalExperience = 0;
        }
      } else {
        teacher.professionalInfo.totalExperience = 0;
      }
    } catch (expError) {
      console.log('Error calculating total experience:', expError.message);
      teacher.professionalInfo.totalExperience = 0;
    }
  }

  // ✅ 5. Profile completion logic — updated for 3-step form
  const requiredFields = [
    'personalInfo.firstName',
    'personalInfo.lastName',
    'personalInfo.phone',
    'personalInfo.bio',
    'professionalInfo.qualification',
    'professionalInfo.specialization',
    'professionalInfo.skills'
  ];

  const isComplete = requiredFields.every(field => {
    const [parent, child] = field.split('.');
    return teacher[parent] && teacher[parent][child] && teacher[parent][child].length > 0;
  });

  teacher.isProfileComplete = isComplete;

  // ✅ 5. Save updated teacher document
  try {
    await teacher.save();
    console.log('updateTeacherProfile - Teacher profile saved successfully');
    
    res.json({
      success: true,
      message: 'Teacher profile updated successfully',
      teacher
    });
  } catch (saveError) {
    console.error('updateTeacherProfile - Error saving teacher profile:', saveError);
    return res.status(500).json({
      success: false,
      message: 'Failed to save teacher profile',
      error: saveError.message
    });
  }
});

// @desc    Upload resume
// @route   POST /api/teachers/upload-resume
// @access  Private (Teacher)
const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  try {
    const result = await uploadToCloudinary(req.file, 'teachers/resumes');
    teacher.professionalInfo.resume = result.secure_url;
    await teacher.save();

    res.json({
      success: true,
      message: 'Resume uploaded successfully',
      resumeUrl: result.secure_url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Resume upload failed'
    });
  }
});

// @desc    Search jobs
// @route   GET /api/teachers/jobs/search
// @access  Private (Teacher)
const searchJobs = asyncHandler(async (req, res) => {
  const {
    subject,
    location,
    gradeLevel,
    jobType,
    workMode,
    minSalary,
    maxSalary,
    page = 1,
    limit = 10
  } = req.query;

  const query = { isActive: true };

  if (subject) query['jobDetails.subject'] = new RegExp(subject, 'i');
  if (location) query['location.city'] = new RegExp(location, 'i');
  if (gradeLevel) query['jobDetails.gradeLevel'] = { $in: gradeLevel.split(',') };
  if (jobType) query['jobDetails.jobType'] = jobType;
  if (workMode) query['jobDetails.workMode'] = workMode;
  if (minSalary || maxSalary) {
    query['compensation.salary.min'] = {};
    if (minSalary) query['compensation.salary.min'].$gte = parseInt(minSalary);
    if (maxSalary) query['compensation.salary.min'].$lte = parseInt(maxSalary);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const jobs = await Job.find(query)
    .populate('school', 'schoolName location contactInfo.photos averageRating')
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

// @desc    Get job details
// @route   GET /api/teachers/jobs/:jobId
// @access  Private (Teacher)
const getJobDetails = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.jobId)
    .populate('school', 'schoolName description location contactInfo photos averageRating');

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Increment view count
  job.views += 1;
  await job.save();

  res.json({
    success: true,
    job
  });
});

// @desc    Apply for job
// @route   POST /api/teachers/jobs/:jobId/apply
// @access  Private (Teacher)
const applyForJob = asyncHandler(async (req, res) => {
  const { coverLetter, resume } = req.body;

  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  const job = await Job.findById(req.params.jobId)
    .populate('school');
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if already applied
  const existingApplication = await Application.findOne({
    job: job._id,
    teacher: teacher._id
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: 'You have already applied for this job'
    });
  }

  // Check if job is still active
  if (!job.isActive) {
    return res.status(400).json({
      success: false,
      message: 'This job is no longer active'
    });
  }

  // Check application deadline
  if (job.applicationDeadline && new Date() > job.applicationDeadline) {
    return res.status(400).json({
      success: false,
      message: 'Application deadline has passed'
    });
  }

  const application = await Application.create({
    job: job._id,
    teacher: teacher._id,
    school: job.school._id,
    coverLetter,
    resume: resume || teacher.professionalInfo.resume
  });

  // Increment application count
  job.applicationCount += 1;
  await job.save();

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully',
    application
  });
});

// @desc    Get teacher's applications
// @route   GET /api/teachers/applications
// @access  Private (Teacher)
const getTeacherApplications = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  const applications = await Application.find({ teacher: teacher._id })
    .populate('job', 'title jobDetails subject location')
    .populate('school', 'schoolName')
    .sort({ applicationDate: -1 });

  res.json({
    success: true,
    applications
  });
});

// @desc    Save job
// @route   POST /api/teachers/jobs/:jobId/save
// @access  Private (Teacher)
const saveJob = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  const job = await Job.findById(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Add to saved jobs if not already saved
  if (!teacher.savedJobs) {
    teacher.savedJobs = [];
  }

  if (!teacher.savedJobs.includes(job._id)) {
    teacher.savedJobs.push(job._id);
    await teacher.save();
  }

  res.json({
    success: true,
    message: 'Job saved successfully'
  });
});

// @desc    Get saved jobs
// @route   GET /api/teachers/saved-jobs
// @access  Private (Teacher)
const getSavedJobs = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ user: req.user.id })
    .populate('savedJobs');
  
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  res.json({
    success: true,
    savedJobs: teacher.savedJobs || []
  });
});

// @desc    Review school
// @route   POST /api/teachers/schools/:schoolId/review
// @access  Private (Teacher)
const reviewSchool = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const teacher = await Teacher.findOne({ user: req.user.id });
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher profile not found'
    });
  }

  const school = await School.findById(req.params.schoolId);
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School not found'
    });
  }

  // Check if teacher has worked at this school
  const hasWorked = teacher.professionalInfo.experience.some(exp => 
    exp.school.toLowerCase().includes(school.schoolName.toLowerCase())
  );

  if (!hasWorked) {
    return res.status(400).json({
      success: false,
      message: 'You can only review schools where you have worked'
    });
  }

  // Check if already reviewed
  const existingReview = school.reviews.find(review => 
    review.teacher.toString() === teacher._id.toString()
  );

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'You have already reviewed this school'
    });
  }

  const review = {
    teacher: teacher._id,
    rating,
    comment,
    date: new Date()
  };

  school.reviews.push(review);
  school.calculateAverageRating();
  await school.save();

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    review
  });
});

// @desc    Check username availability
// @route   GET /api/teachers/check-username/:username
// @access  Private (Teacher)
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
  
  // Check if username is taken by another teacher
  const existingTeacher = await Teacher.findOne({ slug: cleanUsername });
  
  res.json({
    success: true,
    available: !existingTeacher,
    username: cleanUsername,
    message: existingTeacher ? 'Username is already taken' : 'Username is available'
  });
});

module.exports = {
  getTeacherProfile,
  getTeacherProfileById,
  updateTeacherProfile,
  uploadProfileImage,
  uploadCoverImage,
  uploadResume,
  searchJobs,
  getJobDetails,
  applyForJob,
  getTeacherApplications,
  saveJob,
  getSavedJobs,
  reviewSchool,
  checkUsernameAvailability
};





