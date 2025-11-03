const express = require('express');
const { body } = require('express-validator');
const {
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
  markAllBlogsAsRead
} = require('../controllers/blogController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../utils/upload');

const router = express.Router();

// Public routes
router.get('/', getPublishedBlogs);
router.get('/featured', getFeaturedBlogs);
router.get('/category/:category', getBlogsByCategory);

// Protected routes (require authentication)
router.use(protect);

// Unread blog tracking
router.get('/unread-count', getUnreadBlogCount);
router.post('/mark-read', markBlogsAsRead);
router.post('/mark-all-read', markAllBlogsAsRead);

// Public route after protected routes
router.get('/:id', getBlogById);

// Like/Unlike blog post
router.post('/:id/like', toggleLike);

// Add comment to blog post
router.post('/:id/comments', [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
], addComment);

// Admin routes (require admin role)
router.use(authorize('admin'));

// Get all blogs (admin view)
router.get('/admin/all', getAllBlogs);

// Get blog statistics
router.get('/admin/stats', getBlogStats);

// Upload blog images
router.post('/admin/upload', upload.array('images', 10), uploadBlogImages);

// Create new blog post
router.post('/admin', [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 50 })
    .withMessage('Content must be at least 50 characters'),
  body('category')
    .isIn(['tips', 'interview-prep', 'updates', 'general'])
    .withMessage('Category must be one of: tips, interview-prep, updates, general'),
  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Excerpt cannot exceed 300 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be one of: draft, published, archived'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),
  body('media')
    .optional()
    .isArray()
    .withMessage('Media must be an array')
], createBlog);

// Update blog post
router.put('/admin/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 50 })
    .withMessage('Content must be at least 50 characters'),
  body('category')
    .optional()
    .isIn(['tips', 'interview-prep', 'updates', 'general'])
    .withMessage('Category must be one of: tips, interview-prep, updates, general'),
  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Excerpt cannot exceed 300 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be one of: draft, published, archived'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),
  body('media')
    .optional()
    .isArray()
    .withMessage('Media must be an array')
], updateBlog);

// Delete blog post
router.delete('/admin/:id', deleteBlog);

module.exports = router;
