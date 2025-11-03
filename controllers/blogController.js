const Blog = require('../models/Blog');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { uploadToCloudinary } = require('../utils/upload');

// Socket.io instance (will be set by server.js)
let io;

// Function to set socket.io instance
const setSocketIO = (socketIO) => {
  io = socketIO;
};

// @desc    Get all blog posts (admin view)
// @route   GET /api/admin/blogs
// @access  Private (Admin)
const getAllBlogs = asyncHandler(async (req, res) => {
  const {
    status,
    category,
    featured,
    search,
    page = 1,
    limit = 10
  } = req.query;

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (featured !== undefined) query.featured = featured === 'true';
  
  // Add search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const blogs = await Blog.find(query)
    .populate('author', 'email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Blog.countDocuments(query);

  res.json({
    success: true,
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get published blog posts (public)
// @route   GET /api/blogs
// @access  Public
const getPublishedBlogs = asyncHandler(async (req, res) => {
  const {
    category,
    featured,
    search,
    page = 1,
    limit = 10
  } = req.query;

  const query = { status: 'published' };
  if (category) query.category = category;
  if (featured !== undefined) query.featured = featured === 'true';
  
  // Add search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const blogs = await Blog.find(query)
    .populate('author', 'email role')
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Blog.countDocuments(query);

  res.json({
    success: true,
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get blog post by ID
// @route   GET /api/blogs/:id
// @access  Public
const getBlogById = asyncHandler(async (req, res) => {
  // Use lean() to get plain object and avoid validation errors on read
  let blog = await Blog.findById(req.params.id)
    .populate('author', 'email role')
    .populate('comments.user', 'email role')
    .lean();

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Truncate excerpt if it exceeds 300 characters (fix for existing blogs)
  if (blog.excerpt && blog.excerpt.length > 300) {
    blog.excerpt = blog.excerpt.substring(0, 300).replace(/\s+\S*$/, '') + '...';
    
    // Update the excerpt in database (without validation to avoid errors)
    await Blog.findByIdAndUpdate(
      req.params.id,
      { excerpt: blog.excerpt },
      { runValidators: false }
    );
  }

  // Increment views if it's a published post (use updateOne to avoid validation)
  if (blog.status === 'published') {
    await Blog.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { runValidators: false }
    );
    blog.views = (blog.views || 0) + 1;
  }

  res.json({
    success: true,
    blog
  });
});

// @desc    Create new blog post
// @route   POST /api/admin/blogs
// @access  Private (Admin)
const createBlog = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    excerpt,
    category,
    tags,
    status = 'draft',
    featured = false,
    media = []
  } = req.body;

  const blog = await Blog.create({
    title,
    content,
    excerpt,
    category,
    tags: tags || [],
    author: req.user.id,
    status,
    featured,
    media: media || []
  });

  const populatedBlog = await Blog.findById(blog._id)
    .populate('author', 'email role');

  // Emit socket event for real-time updates
  if (io) {
    io.to('admin_blog_room').emit('blog_created', populatedBlog);
    if (status === 'published') {
      io.to('blog_room').emit('new_blog_published', populatedBlog);
    }
  }

  // Send notification to all users when a blog is published
  if (status === 'published') {
    try {
      const Notification = require('../models/Notification');
      const User = require('../models/User');
      
      // Get all users except the author
      const users = await User.find({ 
        _id: { $ne: req.user.id },
        role: { $in: ['teacher', 'school'] }
      }).select('_id');

      // Create notifications for all users
      const notifications = users.map(user => ({
        user: user._id,
        type: 'blog_published',
        title: 'New Blog Post Published',
        message: `A new blog post "${title}" has been published in the ${category} category.`,
        data: {
          blogId: populatedBlog._id,
          blogTitle: title,
          category: category,
          author: populatedBlog.author?.email
        }
      }));

      await Notification.insertMany(notifications);

      // Emit notification to all users
      if (io) {
        io.emit('new_notification', {
          type: 'blog_published',
          title: 'New Blog Post Published',
          message: `A new blog post "${title}" has been published.`,
          data: {
            blogId: populatedBlog._id,
            blogTitle: title,
            category: category
          }
        });
      }
    } catch (error) {
      console.error('Error sending blog notifications:', error);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Blog post created successfully',
    blog: populatedBlog
  });
});

// @desc    Update blog post
// @route   PUT /api/admin/blogs/:id
// @access  Private (Admin)
const updateBlog = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    excerpt,
    category,
    tags,
    status,
    featured,
    media
  } = req.body;

  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Update fields
  if (title) blog.title = title;
  if (content) blog.content = content;
  if (excerpt) blog.excerpt = excerpt;
  if (category) blog.category = category;
  if (tags) blog.tags = tags;
  if (status !== undefined) blog.status = status;
  if (featured !== undefined) blog.featured = featured;
  if (media !== undefined) blog.media = media;

  await blog.save();

  const populatedBlog = await Blog.findById(blog._id)
    .populate('author', 'email role');

  // Emit socket event for real-time updates
  if (io) {
    io.to('admin_blog_room').emit('blog_updated', populatedBlog);
    if (populatedBlog.status === 'published') {
      io.to('blog_room').emit('blog_updated', populatedBlog);
    }
  }

  res.json({
    success: true,
    message: 'Blog post updated successfully',
    blog: populatedBlog
  });
});

// @desc    Delete blog post
// @route   DELETE /api/admin/blogs/:id
// @access  Private (Admin)
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  await Blog.findByIdAndDelete(req.params.id);

  // Emit socket event for real-time updates
  if (io) {
    io.to('admin_blog_room').emit('blog_deleted', req.params.id);
    io.to('blog_room').emit('blog_deleted', req.params.id);
  }

  res.json({
    success: true,
    message: 'Blog post deleted successfully'
  });
});

// @desc    Like/Unlike blog post
// @route   POST /api/blogs/:id/like
// @access  Private
const toggleLike = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  const userId = req.user.id;
  const isLiked = blog.likes.includes(userId);

  if (isLiked) {
    await blog.removeLike(userId);
  } else {
    await blog.addLike(userId);
  }

  res.json({
    success: true,
    message: isLiked ? 'Blog post unliked' : 'Blog post liked',
    isLiked: !isLiked,
    likeCount: blog.likes.length
  });
});

// @desc    Add comment to blog post
// @route   POST /api/blogs/:id/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Comment content is required'
    });
  }

  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  await blog.addComment(req.user.id, content);

  const updatedBlog = await Blog.findById(req.params.id)
    .populate('comments.user', 'email role');

  res.json({
    success: true,
    message: 'Comment added successfully',
    blog: updatedBlog
  });
});

// @desc    Get blog statistics
// @route   GET /api/admin/blogs/stats
// @access  Private (Admin)
const getBlogStats = asyncHandler(async (req, res) => {
  const totalBlogs = await Blog.countDocuments();
  const publishedBlogs = await Blog.countDocuments({ status: 'published' });
  const draftBlogs = await Blog.countDocuments({ status: 'draft' });
  const featuredBlogs = await Blog.countDocuments({ featured: true });
  const totalViews = await Blog.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);
  const totalLikes = await Blog.aggregate([
    { $group: { _id: null, totalLikes: { $sum: { $size: '$likes' } } } }
  ]);
  const totalComments = await Blog.aggregate([
    { $group: { _id: null, totalComments: { $sum: { $size: '$comments' } } } }
  ]);

  // Category breakdown
  const categoryStats = await Blog.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Recent activity
  const recentBlogs = await Blog.find()
    .populate('author', 'email role')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    stats: {
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      featuredBlogs,
      totalViews: totalViews[0]?.totalViews || 0,
      totalLikes: totalLikes[0]?.totalLikes || 0,
      totalComments: totalComments[0]?.totalComments || 0,
      categoryStats
    },
    recentBlogs
  });
});

// @desc    Get featured blog posts
// @route   GET /api/blogs/featured
// @access  Public
const getFeaturedBlogs = asyncHandler(async (req, res) => {
  const blogs = await Blog.getFeatured();

  res.json({
    success: true,
    blogs
  });
});

// @desc    Get blogs by category
// @route   GET /api/blogs/category/:category
// @access  Public
const getBlogsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const blogs = await Blog.find({ status: 'published', category })
    .populate('author', 'email role')
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Blog.countDocuments({ status: 'published', category });

  res.json({
    success: true,
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Upload blog images
// @route   POST /api/blogs/admin/upload
// @access  Private (Admin)
const uploadBlogImages = asyncHandler(async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      try {
        const result = await uploadToCloudinary(file, 'teacherslink/blog');
        return {
          url: result.secure_url,
          filename: file.originalname,
          type: 'image',
          publicId: result.public_id
        };
      } catch (error) {
        console.error('Error uploading file:', file.originalname, error);
        throw error;
      }
    });

    const uploadedImages = await Promise.all(uploadPromises);

    res.json({
      success: true,
      message: `${uploadedImages.length} image(s) uploaded successfully`,
      images: uploadedImages
    });
  } catch (error) {
    console.error('Error uploading blog images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message
    });
  }
});

// @desc    Get unread blog count for user
// @route   GET /api/blogs/unread-count
// @access  Private
const getUnreadBlogCount = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's last read timestamp
    const user = await User.findById(userId).select('lastBlogReadAt');
    const lastReadAt = user?.lastBlogReadAt || new Date(0);
    
    // Count blogs published after last read
    const count = await Blog.countDocuments({
      status: 'published',
      publishedAt: { $gt: lastReadAt }
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error getting unread blog count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread blog count'
    });
  }
});

// @desc    Mark specific blogs as read
// @route   POST /api/blogs/mark-read
// @access  Private
const markBlogsAsRead = asyncHandler(async (req, res) => {
  try {
    const { blogIds } = req.body;
    const userId = req.user.id;

    if (!blogIds || !Array.isArray(blogIds)) {
      return res.status(400).json({
        success: false,
        message: 'Blog IDs array is required'
      });
    }

    // Update user's last read timestamp to now
    await User.findByIdAndUpdate(userId, {
      lastBlogReadAt: new Date()
    });

    res.json({
      success: true,
      message: 'Blogs marked as read'
    });
  } catch (error) {
    console.error('Error marking blogs as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark blogs as read'
    });
  }
});

// @desc    Mark all blogs as read
// @route   POST /api/blogs/mark-all-read
// @access  Private
const markAllBlogsAsRead = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Update user's last read timestamp to now
    await User.findByIdAndUpdate(userId, {
      lastBlogReadAt: new Date()
    });

    res.json({
      success: true,
      message: 'All blogs marked as read'
    });
  } catch (error) {
    console.error('Error marking all blogs as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all blogs as read'
    });
  }
});

module.exports = {
  getAllBlogs,
  getPublishedBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  toggleLike,
  addComment,
  getBlogStats,
  getFeaturedBlogs,
  getBlogsByCategory,
  uploadBlogImages,
  getUnreadBlogCount,
  markBlogsAsRead,
  markAllBlogsAsRead,
  setSocketIO
};
