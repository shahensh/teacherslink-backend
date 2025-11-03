const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Share = require('../models/Share');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const Connection = require('../models/Connection');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { uploadToCloudinary } = require('../utils/upload');
const { compressVideo, getCompressionSettings, shouldCompress } = require('../utils/videoCompression');
const { moderateImage, getModerationErrorMessage } = require('../services/imageModeration');
const cloudinary = require('cloudinary').v2;

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
  const { caption, tags, privacy = 'public', location } = req.body;
  
  // Get user's profile based on role
  let authorProfile, authorProfileType;
  if (req.user.role === 'school') {
    authorProfile = await School.findOne({ user: req.user.id });
    authorProfileType = 'School';
  } else if (req.user.role === 'teacher') {
    authorProfile = await Teacher.findOne({ user: req.user.id });
    authorProfileType = 'Teacher';
  }

  if (!authorProfile) {
    return res.status(404).json({
      success: false,
      message: 'Profile not found'
    });
  }

  // Validate that post has content (caption or media)
  if ((!caption || caption.trim() === '') && (!req.files || req.files.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Post must contain either text or media'
    });
  }

  // Handle media uploads with video compression
  let media = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      let fileToUpload = file;
      let compressionInfo = null;
      
      // Check if it's a video and needs compression
      if (file.mimetype.startsWith('video/')) {
        console.log('Processing video file for compression:', {
          fileName: file.originalname,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          mimeType: file.mimetype
        });
        
        try {
          // Get compression settings based on file size
          const compressionSettings = getCompressionSettings(file.size, 'medium');
          
          // Compress the video
          const compressionResult = await compressVideo(file, compressionSettings, (progress, stage) => {
            console.log(`Video compression progress: ${progress}% - ${stage}`);
          });
          
          // Create new file object with compressed data
          fileToUpload = {
            ...file,
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
      }
      
      const uploaded = await uploadToCloudinary(fileToUpload, 'posts');
      const type = file.mimetype.startsWith('video') ? 'video' : 'image';
      
      // Moderate images (skip videos)
      if (type === 'image') {
        console.log('🔍 Moderating post image:', uploaded.secure_url);
        const moderationResult = await moderateImage(uploaded.secure_url);
        
        if (!moderationResult.skipped && moderationResult.isInappropriate) {
          console.log('❌ Inappropriate content detected in post image:', moderationResult.detectedLabels);
          
          // Delete the image from Cloudinary
          try {
            await cloudinary.uploader.destroy(uploaded.public_id);
            console.log('🗑️ Deleted inappropriate post image from Cloudinary');
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
        
        console.log('✅ Post image passed moderation');
      }
      
      media.push({
        url: uploaded.secure_url,
        type,
        alt: file.originalname,
        compressionInfo: compressionInfo
      });
    }
  }

  // Create post
  const post = await Post.create({
    author: req.user.id,
    authorProfile: authorProfile._id,
    authorProfileType,
    caption: caption || '', // Ensure caption is never undefined
    media,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    privacy,
    location: location ? JSON.parse(location) : undefined
  });

  // Populate author info
  await post.populate([
    { path: 'author', select: 'email role' },
    { path: 'authorProfile', select: 'schoolName personalInfo' }
  ]);

  // Emit real-time event
  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('new_post', {
      type: 'post_created',
      data: post,
      timestamp: new Date().toISOString()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    post
  });
});

// @desc    Get posts feed (public posts + connections' posts)
// @route   GET /api/posts/feed
// @access  Private
const getFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  // Get user's connections
  const connections = await Connection.find({
    $or: [
      { requester: req.user.id, status: 'accepted' },
      { recipient: req.user.id, status: 'accepted' }
    ]
  }).select('requester recipient');

  const connectedUserIds = connections.map(conn => 
    conn.requester.toString() === req.user.id ? conn.recipient : conn.requester
  );

  // Add current user to see their own posts
  connectedUserIds.push(req.user.id);

  // Get posts from connections and public posts
  const posts = await Post.find({
    $or: [
      { author: { $in: connectedUserIds } },
      { privacy: 'public' }
    ],
    isPublished: true
  })
  .populate('author', 'email role')
  .populate('authorProfile', 'schoolName personalInfo')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  // Get like status for current user
  const postIds = posts.map(post => post._id);
  const userLikes = await Like.find({
    user: req.user.id,
    post: { $in: postIds }
  });

  const likeMap = {};
  userLikes.forEach(like => {
    likeMap[like.post.toString()] = like.type;
  });

  // Add like status to posts
  const postsWithLikes = posts.map(post => ({
    ...post.toObject(),
    likedByMe: likeMap[post._id] || null
  }));

  const total = await Post.countDocuments({
    $or: [
      { author: { $in: connectedUserIds } },
      { privacy: 'public' }
    ],
    isPublished: true
  });

  res.json({
    success: true,
    posts: postsWithLikes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get posts by user profile
// @route   GET /api/posts/profile/:profileId
// @access  Public
const getProfilePosts = asyncHandler(async (req, res) => {
  const { profileId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const posts = await Post.find({
    authorProfile: profileId,
    isPublished: true
  })
  .populate('author', 'email role')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  // Populate authorProfile based on type
  const postsWithAuthor = await Promise.all(posts.map(async (post) => {
    const postObj = post.toObject();
    
    if (post.authorProfileType === 'School') {
      const School = require('../models/School');
      const school = await School.findById(post.authorProfile);
      if (school) {
        postObj.authorProfile = {
          _id: school._id,
          schoolName: school.schoolName,
          slug: school.slug,
          profileImage: school.profileImage
        };
      }
    } else if (post.authorProfileType === 'Teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findById(post.authorProfile);
      if (teacher) {
        postObj.authorProfile = {
          _id: teacher._id,
          fullName: teacher.fullName,
          slug: teacher.slug,
          profileImage: teacher.profileImage
        };
      }
    }
    
    return postObj;
  }));

  const total = await Post.countDocuments({
    authorProfile: profileId,
    isPublished: true
  });

  res.json({
    success: true,
    posts: postsWithAuthor,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});


// @desc    Add comment to post
// @route   POST /api/posts/:postId/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text, parentComment } = req.body;

  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const comment = await Comment.create({
    user: req.user.id,
    post: postId,
    text,
    parentComment: parentComment || null
  });

  // Update comment count
  await Post.findByIdAndUpdate(postId, {
    $inc: { commentsCount: 1 }
  });

  // If it's a reply, update parent comment's replies count
  if (parentComment) {
    await Comment.findByIdAndUpdate(parentComment, {
      $inc: { repliesCount: 1 }
    });
  }

  await comment.populate('user', 'email role');

  // Add author information similar to getComments
  let authorName = 'Unknown User';
  let authorSlug = null;
  let authorProfileImage = null;

  if (comment.user) {
    if (comment.user.role === 'school') {
      // Fetch school profile for username and profile image
      const school = await School.findOne({ user: comment.user._id });
      if (school) {
        authorName = school.schoolName || comment.user.email;
        authorSlug = school.slug;
        authorProfileImage = school.profileImage;
      } else {
        authorName = comment.user.email;
      }
    } else if (comment.user.role === 'teacher') {
      // Fetch teacher profile for username and profile image
      const teacher = await Teacher.findOne({ user: comment.user._id });
      if (teacher) {
        authorName = teacher.personalInfo?.name || comment.user.email;
        authorSlug = teacher.slug;
        authorProfileImage = teacher.profileImage;
      } else {
        authorName = comment.user.email;
      }
    } else {
      authorName = comment.user.email;
    }
  }

  // Add author information to comment object
  comment.author = {
    name: authorName,
    slug: authorSlug,
    email: comment.user?.email,
    role: comment.user?.role,
    profileImage: authorProfileImage
  };

  // Emit real-time event
  const io = req.app.get('io');
  if (io) {
    io.to(`post:${postId}`).emit('post_commented', {
      type: 'post_commented',
      postId,
      comment,
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Comment added',
    comment
  });
});

// @desc    Get comments for a post
// @route   GET /api/posts/:postId/comments
// @access  Public
const getComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const comments = await Comment.find({
    post: postId,
    parentComment: null // Only top-level comments
  })
  .populate('user', 'email role')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  // Transform comments to include author information with proper username and profile image
  const commentsWithAuthor = await Promise.all(comments.map(async (comment) => {
    let authorName = 'Unknown User';
    let authorSlug = null;
    let authorProfileImage = null;

    if (comment.user) {
      if (comment.user.role === 'school') {
        // Fetch school profile for username and profile image
        const school = await School.findOne({ user: comment.user._id });
        if (school) {
          authorName = school.schoolName || comment.user.email;
          authorSlug = school.slug;
          authorProfileImage = school.profileImage;
        } else {
          authorName = comment.user.email;
        }
      } else if (comment.user.role === 'teacher') {
        // Fetch teacher profile for username and profile image
        const teacher = await Teacher.findOne({ user: comment.user._id });
        if (teacher) {
          authorName = teacher.personalInfo?.name || comment.user.email;
          authorSlug = teacher.slug;
          authorProfileImage = teacher.profileImage;
        } else {
          authorName = comment.user.email;
        }
      } else {
        authorName = comment.user.email;
      }
    }

    return {
      ...comment.toObject(),
      author: {
        name: authorName,
        slug: authorSlug,
        email: comment.user?.email,
        role: comment.user?.role,
        profileImage: authorProfileImage
      }
    };
  }));

  const total = await Comment.countDocuments({
    post: postId,
    parentComment: null
  });

  res.json({
    success: true,
    comments: commentsWithAuthor,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Share a post
// @route   POST /api/posts/:postId/share
// @access  Private
const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { caption, type = 'share' } = req.body;

  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const share = await Share.create({
    user: req.user.id,
    post: postId,
    caption,
    type
  });

  // Update share count
  await Post.findByIdAndUpdate(postId, {
    $inc: { sharesCount: 1 }
  });

  await share.populate('user', 'email role');

  // Emit real-time event
  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('post_shared', {
      type: 'post_shared',
      postId,
      share,
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Post shared',
    share
  });
});

// @desc    Delete a post
// @route   DELETE /api/posts/:postId
// @access  Private
const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findOne({
    _id: postId,
    author: req.user.id
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found or unauthorized'
    });
  }

  // Delete associated data
  await Comment.deleteMany({ post: postId });
  await Share.deleteMany({ post: postId });

  // Delete the post
  await Post.findByIdAndDelete(postId);

  res.json({
    success: true,
    message: 'Post deleted successfully'
  });
});

// @desc    Update a post
// @route   PUT /api/posts/:postId
// @access  Private
const updatePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { caption, tags } = req.body;

  const post = await Post.findOne({
    _id: postId,
    author: req.user.id
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found or unauthorized'
    });
  }

  // Handle new media uploads
  let newMedia = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const uploaded = await uploadToCloudinary(file, 'posts');
      const type = file.mimetype.startsWith('video') ? 'video' : 'image';
      newMedia.push({
        url: uploaded.secure_url,
        type,
        alt: file.originalname
      });
    }
  }

  // Update post
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    {
      caption: caption || post.caption,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : post.tags,
      media: newMedia.length > 0 ? [...post.media, ...newMedia] : post.media,
      isEdited: true,
      editedAt: new Date()
    },
    { new: true }
  ).populate([
    { path: 'author', select: 'email role' },
    { path: 'authorProfile', select: 'schoolName personalInfo' }
  ]);

  res.json({
    success: true,
    message: 'Post updated successfully',
    post: updatedPost
  });
});

module.exports = {
  createPost,
  getFeed,
  getProfilePosts,
  addComment,
  getComments,
  sharePost,
  deletePost,
  updatePost
};
