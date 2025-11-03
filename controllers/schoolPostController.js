const School = require('../models/School');
const SchoolPost = require('../models/SchoolPost');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { uploadToCloudinary } = require('../utils/upload');
const { moderateImage, getModerationErrorMessage } = require('../services/imageModeration');
const cloudinary = require('cloudinary').v2;

// @desc    Public: Get school profile by slug and recent posts
// @route   GET /api/public/schools/:slug
// @access  Public
const getPublicSchoolProfile = asyncHandler(async (req, res) => {
  const school = await School.findOne({ slug: req.params.slug })
    .populate('user', 'isVerified plan')
    .select('-reviews');

  if (!school) {
    return res.status(404).json({ success: false, message: 'School not found' });
  }

  // Add plan information to school object
  if (school.user && school.user.plan) {
    school.plan = school.user.plan;
  }

  const posts = await SchoolPost.find({ school: school._id, isPublished: true })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({ success: true, school, posts });
});

// @desc    Public: Get school posts by slug (paginated)
// @route   GET /api/public/schools/:slug/posts
// @access  Public
const getPublicSchoolPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const school = await School.findOne({ slug: req.params.slug }).select('_id');
  if (!school) return res.status(404).json({ success: false, message: 'School not found' });

  const posts = await SchoolPost.find({ school: school._id, isPublished: true })
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));
  const total = await SchoolPost.countDocuments({ school: school._id, isPublished: true });
  res.json({ success: true, posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// @desc    Private: Create a school post
// @route   POST /api/schools/posts
// @access  Private (School)
const createPost = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) return res.status(404).json({ success: false, message: 'School profile not found' });

  let media = [];
  if (req.files && req.files.length) {
    for (const file of req.files) {
      const uploaded = await uploadToCloudinary(file, 'schools/posts');
      const type = (file.mimetype || '').startsWith('video') ? 'video' : 'image';
      
      // Moderate images (skip videos)
      if (type === 'image') {
        console.log('🔍 Moderating school post image:', uploaded.secure_url);
        const moderationResult = await moderateImage(uploaded.secure_url);
        
        if (!moderationResult.skipped && moderationResult.isInappropriate) {
          console.log('❌ Inappropriate content detected in school post:', moderationResult.detectedLabels);
          
          // Delete the image from Cloudinary
          try {
            await cloudinary.uploader.destroy(uploaded.public_id);
            console.log('🗑️ Deleted inappropriate school post image from Cloudinary');
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
        
        console.log('✅ School post image passed moderation');
      }
      
      media.push({ url: uploaded.secure_url, type });
    }
  } else if (req.body.media && Array.isArray(req.body.media)) {
    media = req.body.media;
  }

  const post = await SchoolPost.create({
    school: school._id,
    caption: req.body.caption,
    media,
    tags: req.body.tags || [],
    isPublished: true
  });

  res.status(201).json({ success: true, message: 'Post created', post });
});

// @desc    Private: Delete a post
// @route   DELETE /api/schools/posts/:postId
// @access  Private (School)
const deletePost = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) return res.status(404).json({ success: false, message: 'School profile not found' });

  const post = await SchoolPost.findOneAndDelete({ _id: req.params.postId, school: school._id });
  if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

  res.json({ success: true, message: 'Post deleted' });
});

module.exports = {
  getPublicSchoolProfile,
  getPublicSchoolPosts,
  createPost,
  deletePost
};


