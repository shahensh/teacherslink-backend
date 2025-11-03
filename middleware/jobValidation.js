const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Job creation validation
const validateJobCreation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Job title is required')
    .isLength({ max: 100 })
    .withMessage('Job title cannot exceed 100 characters'),
  
  body('department')
    .notEmpty()
    .withMessage('Department is required')
    .isIn([
      'Elementary', 'Middle School', 'High School', 'Special Education',
      'Mathematics', 'Science', 'English', 'Social Studies', 'Art',
      'Music', 'Physical Education', 'Technology', 'Administration',
      'Counseling', 'Library', 'Other'
    ])
    .withMessage('Invalid department'),
  
  body('employmentType')
    .notEmpty()
    .withMessage('Employment type is required')
    .isIn(['full-time', 'part-time', 'contract', 'substitute', 'temporary'])
    .withMessage('Invalid employment type'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),
  
  body('applicationDeadline')
    .isISO8601()
    .withMessage('Valid application deadline is required')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Application deadline cannot be in the past');
      }
      return true;
    }),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Job description is required')
    .isLength({ min: 50, max: 5000 })
    .withMessage('Description must be between 50 and 5000 characters'),
  
  body('requirements.education')
    .trim()
    .notEmpty()
    .withMessage('Education requirement is required'),
  
  body('requirements.experience')
    .trim()
    .notEmpty()
    .withMessage('Experience requirement is required'),
  
  body('salary.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum salary must be a number')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Minimum salary cannot be negative');
      }
      return true;
    }),
  
  body('salary.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum salary must be a number')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Maximum salary cannot be negative');
      }
      return true;
    }),
  
  body('salary.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  
  body('location.remote')
    .optional()
    .isBoolean()
    .withMessage('Remote must be a boolean'),
  
  body('location.hybrid')
    .optional()
    .isBoolean()
    .withMessage('Hybrid must be a boolean'),
  
  body('schedule.flexibility')
    .optional()
    .isIn(['Fixed', 'Flexible', 'Part-time flexible'])
    .withMessage('Invalid schedule flexibility'),
  
  body('urgent')
    .optional()
    .isBoolean()
    .withMessage('Urgent must be a boolean'),
  
  handleValidationErrors
];

// Job update validation
const validateJobUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Job title cannot exceed 100 characters'),
  
  body('department')
    .optional()
    .isIn([
      'Elementary', 'Middle School', 'High School', 'Special Education',
      'Mathematics', 'Science', 'English', 'Social Studies', 'Art',
      'Music', 'Physical Education', 'Technology', 'Administration',
      'Counseling', 'Library', 'Other'
    ])
    .withMessage('Invalid department'),
  
  body('employmentType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'substitute', 'temporary'])
    .withMessage('Invalid employment type'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  
  body('applicationDeadline')
    .optional()
    .isISO8601()
    .withMessage('Valid application deadline is required'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 50, max: 5000 })
    .withMessage('Description must be between 50 and 5000 characters'),
  
  body('salary.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum salary must be a number'),
  
  body('salary.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum salary must be a number'),
  
  body('salary.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  
  handleValidationErrors
];

// Template validation
const validateTemplateCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name cannot exceed 100 characters'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn([
      'Elementary Teacher', 'Middle School Teacher', 'High School Teacher',
      'Special Education', 'Administrator', 'Counselor', 'Librarian',
      'Art Teacher', 'Music Teacher', 'PE Teacher', 'Technology',
      'Substitute Teacher', 'Part-time', 'Contract', 'Other'
    ])
    .withMessage('Invalid category'),
  
  body('templateData.title')
    .trim()
    .notEmpty()
    .withMessage('Job title is required'),
  
  body('templateData.department')
    .notEmpty()
    .withMessage('Department is required'),
  
  body('templateData.employmentType')
    .notEmpty()
    .withMessage('Employment type is required'),
  
  body('templateData.description')
    .trim()
    .notEmpty()
    .withMessage('Job description is required'),
  
  body('templateData.requirements.education')
    .trim()
    .notEmpty()
    .withMessage('Education requirement is required'),
  
  body('templateData.requirements.experience')
    .trim()
    .notEmpty()
    .withMessage('Experience requirement is required'),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  
  handleValidationErrors
];

// Query parameter validation
const validateJobQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('department')
    .optional()
    .isIn([
      'Elementary', 'Middle School', 'High School', 'Special Education',
      'Mathematics', 'Science', 'English', 'Social Studies', 'Art',
      'Music', 'Physical Education', 'Technology', 'Administration',
      'Counseling', 'Library', 'Other'
    ])
    .withMessage('Invalid department filter'),
  
  query('employmentType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'substitute', 'temporary'])
    .withMessage('Invalid employment type filter'),
  
  query('salaryMin')
    .optional()
    .isNumeric()
    .withMessage('Minimum salary must be a number'),
  
  query('salaryMax')
    .optional()
    .isNumeric()
    .withMessage('Maximum salary must be a number'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'title', 'department', 'salary.min', 'views', 'applications'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  handleValidationErrors
];

// ID parameter validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

// Analytics query validation
const validateAnalyticsQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  
  handleValidationErrors
];

module.exports = {
  validateJobCreation,
  validateJobUpdate,
  validateTemplateCreation,
  validateJobQuery,
  validateObjectId,
  validateAnalyticsQuery,
  handleValidationErrors
};




