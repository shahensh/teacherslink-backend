const express = require('express');
const router = express.Router();
const { getPublicStats } = require('../controllers/statsController');

// Public stats endpoint
router.get('/public', getPublicStats);

module.exports = router;



