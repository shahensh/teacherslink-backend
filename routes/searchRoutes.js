const express = require('express');
const router = express.Router();
const {
  searchProfiles,
  searchTeachers,
  searchSchools,
  getSearchSuggestions
} = require('../controllers/searchController');

// Search all profiles (teachers and schools)
router.get('/profiles', searchProfiles);

// Search teachers only
router.get('/teachers', searchTeachers);

// Search schools only
router.get('/schools', searchSchools);

// Get search suggestions
router.get('/suggestions', getSearchSuggestions);

module.exports = router;

