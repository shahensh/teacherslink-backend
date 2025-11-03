const Webinar = require('../models/Webinar');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { uploadToCloudinary } = require('../utils/upload');
const { compressVideo, getCompressionSettings, shouldCompress } = require('../utils/videoCompression');

// Socket.io instance (will be set by server.js)
let io;

// Function to set socket.io instance
const setSocketIO = (socketIO) => {
  io = socketIO;
};

// @desc    Get all webinars
// @route   GET /api/webinars
// @access  Public
const getAllWebinars = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    status,
    category,
    search,
    featured,
    public: isPublic
  } = req.query;

  // Build query
  const query = {};

  if (type) query.type = type;
  if (status) query.status = status;
  if (category) query.category = category;
  if (featured === 'true') query.isFeatured = true;
  if (isPublic === 'true') query.isPublic = true;

  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { 'presenter.name': { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const webinars = await Webinar.find(query)
    .populate('attendees.user', 'email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Webinar.countDocuments(query);

  res.json({
    success: true,
    webinars,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get webinar by ID
// @route   GET /api/webinars/:id
// @access  Public
const getWebinarById = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id)
    .populate('attendees.user', 'email role');

  if (!webinar) {
    return res.status(404).json({
      success: false,
      message: 'Webinar not found'
    });
  }

  // Increment view count
  webinar.views += 1;
  await webinar.save();

  res.json({
    success: true,
    webinar
  });
});

// @desc    Create new webinar
// @route   POST /api/webinars
// @access  Private (Admin)
const createWebinar = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    type,
    scheduledDate,
    duration,
    maxParticipants,
    meetingLink,
    recordingUrl,
    videoFile,
    tags,
    category,
    presenter,
    isFeatured,
    isPublic
  } = req.body;

  const durationValue = parseInt(duration);
  
  const webinar = await Webinar.create({
    title,
    description,
    type,
    scheduledDate: type === 'live' ? new Date(scheduledDate) : undefined,
    duration: durationValue,
    maxParticipants: parseInt(maxParticipants) || 100,
    meetingLink: type === 'live' ? meetingLink : undefined,
    recordingUrl: type === 'recorded' && !videoFile ? recordingUrl : undefined,
    videoFile: type === 'recorded' && videoFile ? videoFile : undefined,
    tags: tags || [],
    category,
    presenter,
    isFeatured: isFeatured === 'true' || isFeatured === true,
    isPublic: isPublic !== 'false' && isPublic !== false
  });

  const populatedWebinar = await Webinar.findById(webinar._id)
    .populate('attendees.user', 'email role');

  // Emit socket event for real-time updates
  if (io) {
    io.emit('webinar_created', populatedWebinar);
  }

  res.status(201).json({
    success: true,
    webinar: populatedWebinar
  });
});

// @desc    Update webinar
// @route   PUT /api/webinars/:id
// @access  Private (Admin)
const updateWebinar = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    type,
    scheduledDate,
    duration,
    maxParticipants,
    meetingLink,
    recordingUrl,
    videoFile,
    tags,
    category,
    presenter,
    isFeatured,
    isPublic,
    status
  } = req.body;

  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    return res.status(404).json({
      success: false,
      message: 'Webinar not found'
    });
  }

  // Update fields
  if (title) webinar.title = title;
  if (description) webinar.description = description;
  if (type) webinar.type = type;
  if (scheduledDate) webinar.scheduledDate = new Date(scheduledDate);
  if (duration) webinar.duration = parseInt(duration);
  if (maxParticipants) webinar.maxParticipants = parseInt(maxParticipants);
  if (meetingLink) webinar.meetingLink = meetingLink;
  if (recordingUrl) webinar.recordingUrl = recordingUrl;
  if (videoFile) webinar.videoFile = videoFile;
  if (tags) webinar.tags = tags;
  if (category) webinar.category = category;
  if (presenter) webinar.presenter = presenter;
  if (isFeatured !== undefined) webinar.isFeatured = isFeatured;
  if (isPublic !== undefined) webinar.isPublic = isPublic;
  if (status) webinar.status = status;

  await webinar.save();

  const populatedWebinar = await Webinar.findById(webinar._id)
    .populate('attendees.user', 'email role');

  // Emit socket event for real-time updates
  if (io) {
    io.emit('webinar_updated', populatedWebinar);
  }

  res.json({
    success: true,
    webinar: populatedWebinar
  });
});

// @desc    Delete webinar
// @route   DELETE /api/webinars/:id
// @access  Private (Admin)
const deleteWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    return res.status(404).json({
      success: false,
      message: 'Webinar not found'
    });
  }

  await Webinar.findByIdAndDelete(req.params.id);

  // Emit socket event for real-time updates
  if (io) {
    io.emit('webinar_deleted', req.params.id);
  }

  res.json({
    success: true,
    message: 'Webinar deleted successfully'
  });
});

// @desc    Join webinar
// @route   POST /api/webinars/:id/join
// @access  Private
const joinWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    return res.status(404).json({
      success: false,
      message: 'Webinar not found'
    });
  }

  // Check if user already joined
  const alreadyJoined = webinar.attendees.some(
    attendee => attendee.user.toString() === req.user.id
  );

  if (alreadyJoined) {
    return res.status(400).json({
      success: false,
      message: 'You have already joined this webinar'
    });
  }

  // Check if webinar is at capacity
  if (webinar.attendees.length >= webinar.maxParticipants) {
    return res.status(400).json({
      success: false,
      message: 'Webinar is at maximum capacity'
    });
  }

  // Add user to attendees
  webinar.attendees.push({
    user: req.user.id,
    joinedAt: new Date()
  });

  await webinar.save();

  const populatedWebinar = await Webinar.findById(webinar._id)
    .populate('attendees.user', 'email role');

  // Emit socket event for real-time updates
  if (io) {
    io.emit('webinar_joined', {
      webinarId: webinar._id,
      user: req.user
    });
  }

  res.json({
    success: true,
    message: 'Successfully joined webinar',
    webinar: populatedWebinar
  });
});

// @desc    Leave webinar
// @route   POST /api/webinars/:id/leave
// @access  Private
const leaveWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    return res.status(404).json({
      success: false,
      message: 'Webinar not found'
    });
  }

  // Remove user from attendees
  webinar.attendees = webinar.attendees.filter(
    attendee => attendee.user.toString() !== req.user.id
  );

  await webinar.save();

  const populatedWebinar = await Webinar.findById(webinar._id)
    .populate('attendees.user', 'email role');

  // Emit socket event for real-time updates
  if (io) {
    io.emit('webinar_left', {
      webinarId: webinar._id,
      user: req.user
    });
  }

  res.json({
    success: true,
    message: 'Successfully left webinar',
    webinar: populatedWebinar
  });
});


// @desc    Upload webinar thumbnail
// @route   POST /api/webinars/upload-thumbnail
// @access  Private (Admin)
const uploadThumbnail = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    const result = await uploadToCloudinary(req.file, 'teacherslink/webinars');
    
    res.json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      thumbnail: result.secure_url
    });
  } catch (error) {
    console.error('Error uploading webinar thumbnail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload thumbnail',
      error: error.message
    });
  }
});

// @desc    Upload webinar video file
// @route   POST /api/webinars/upload-video
// @access  Private (Admin)
const uploadVideo = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    // Check file type
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only MP4, AVI, MOV, WMV, and WebM video files are allowed'
      });
    }

    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'Video file size must be less than 500MB'
      });
    }

    let fileToUpload = req.file;
    let compressionInfo = null;

    // Compress all videos for better storage efficiency
    console.log('Compressing video for optimal storage...');
    
    try {
      // Get compression settings based on file size
      const compressionSettings = getCompressionSettings(req.file.size, 'medium');
      
      // Compress the video with progress tracking
      const compressionResult = await compressVideo(req.file, compressionSettings, (progress, stage) => {
        console.log(`Video ${stage}: ${progress}%`);
      });
      
      // Create new file object with compressed data
      fileToUpload = {
        ...req.file,
        buffer: compressionResult.buffer,
        size: compressionResult.compressedSize
      };
      
      compressionInfo = {
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        compressionRatio: compressionResult.compressionRatio,
        compressionTime: compressionResult.compressionTime
      };
      
      console.log('Video compression completed:', compressionInfo);
    } catch (compressionError) {
      console.error('Video compression failed, uploading original:', compressionError.message);
      // Continue with original file if compression fails
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(fileToUpload, 'teacherslink/webinars/videos', {
      resource_type: 'video',
      chunk_size: 6000000, // 6MB chunks for large files
      eager: [
        { width: 300, height: 300, crop: 'pad', audio_codec: 'none' },
        { width: 160, height: 100, crop: 'crop', gravity: 'south', audio_codec: 'none' }
      ],
      eager_async: true
    });

    // Get video duration (this is a simplified approach)
    // In production, you might want to use ffprobe or similar
    // For now, we'll estimate duration based on file size (rough approximation)
    const sizeInMB = fileToUpload.size / (1024 * 1024);
    let duration = 60; // Default 1 minute
    
    // Rough estimation: larger files typically have longer duration
    if (sizeInMB > 100) {
      duration = Math.floor(sizeInMB / 2); // ~2MB per minute
    } else if (sizeInMB > 50) {
      duration = Math.floor(sizeInMB / 1.5); // ~1.5MB per minute
    } else if (sizeInMB > 20) {
      duration = Math.floor(sizeInMB / 1); // ~1MB per minute
    } else {
      duration = Math.floor(sizeInMB * 2); // ~0.5MB per minute for small files
    }
    
    // Ensure minimum duration of 1 minute and maximum of 4 hours
    duration = Math.max(1, Math.min(duration, 240));

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      videoFile: {
        url: result.secure_url,
        filename: req.file.originalname,
        size: fileToUpload.size,
        duration: duration,
        format: req.file.mimetype,
        publicId: result.public_id,
        compressionInfo: compressionInfo
      }
    });
  } catch (error) {
    console.error('Error uploading webinar video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
});

// @desc    Get webinar statistics
// @route   GET /api/webinars/stats
// @access  Private (Admin)
const getWebinarStats = asyncHandler(async (req, res) => {
  const totalWebinars = await Webinar.countDocuments();
  const liveWebinars = await Webinar.countDocuments({ type: 'live' });
  const recordedWebinars = await Webinar.countDocuments({ type: 'recorded' });
  const scheduledWebinars = await Webinar.countDocuments({ status: 'scheduled' });
  const completedWebinars = await Webinar.countDocuments({ status: 'completed' });
  const totalViews = await Webinar.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);
  const totalAttendees = await Webinar.aggregate([
    { $group: { _id: null, totalAttendees: { $sum: { $size: '$attendees' } } } }
  ]);

  res.json({
    success: true,
    stats: {
      totalWebinars,
      liveWebinars,
      recordedWebinars,
      scheduledWebinars,
      completedWebinars,
      totalViews: totalViews[0]?.totalViews || 0,
      totalAttendees: totalAttendees[0]?.totalAttendees || 0
    }
  });
});

module.exports = {
  getAllWebinars,
  getWebinarById,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  joinWebinar,
  leaveWebinar,
  uploadThumbnail,
  uploadVideo,
  getWebinarStats,
  setSocketIO
};
