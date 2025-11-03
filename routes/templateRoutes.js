const express = require('express');
const router = express.Router();
const {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  useTemplate,
  getPublicTemplates,
  getTemplatesBySchool,
  getTemplateCategories,
  duplicateTemplate
} = require('../controllers/templateController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/public', getPublicTemplates);
router.get('/categories', getTemplateCategories);
router.get('/school/:schoolId', getTemplatesBySchool);

// Protected routes
router.use(protect);

// Template management routes
router.post('/', authorize('school', 'admin'), createTemplate);
router.get('/', getTemplates);
router.get('/:id', getTemplate);
router.put('/:id', authorize('school', 'admin'), updateTemplate);
router.delete('/:id', authorize('school', 'admin'), deleteTemplate);
router.post('/:id/use', authorize('school', 'admin'), useTemplate);
router.post('/:id/duplicate', authorize('school', 'admin'), duplicateTemplate);

module.exports = router;




