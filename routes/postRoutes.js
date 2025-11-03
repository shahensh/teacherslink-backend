const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../utils/upload');
const {
  createPost,
  getFeed,
  getProfilePosts,
  addComment,
  getComments,
  sharePost,
  deletePost,
  updatePost
} = require('../controllers/postController');

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', protect, upload.array('media', 10), createPost);

// @route   GET /api/posts/feed
// @desc    Get posts feed (public + connections)
// @access  Private
router.get('/feed', protect, getFeed);

// @route   GET /api/posts/profile/:profileId
// @desc    Get posts by profile
// @access  Public
router.get('/profile/:profileId', getProfilePosts);


// @route   POST /api/posts/:postId/comments
// @desc    Add comment to post
// @access  Private
router.post('/:postId/comments', protect, addComment);

// @route   GET /api/posts/:postId/comments
// @desc    Get comments for a post
// @access  Public
router.get('/:postId/comments', getComments);

// @route   POST /api/posts/:postId/share
// @desc    Share a post
// @access  Private
router.post('/:postId/share', protect, sharePost);

// @route   PUT /api/posts/:postId
// @desc    Update a post
// @access  Private
router.put('/:postId', protect, upload.array('media', 10), updatePost);

// @route   DELETE /api/posts/:postId
// @desc    Delete a post
// @access  Private
router.delete('/:postId', protect, deletePost);

module.exports = router;
