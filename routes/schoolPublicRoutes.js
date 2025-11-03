const express = require('express');
const router = express.Router();
const { getPublicSchoolProfile, getPublicSchoolPosts } = require('../controllers/schoolPostController');

// @route   GET /api/public/schools/:slug
router.get('/schools/:slug', getPublicSchoolProfile);

// @route   GET /api/public/schools/:slug/posts
router.get('/schools/:slug/posts', getPublicSchoolPosts);

module.exports = router;


