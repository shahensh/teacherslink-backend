const asyncHandler = require('express-async-handler');
const JobTemplate = require('../models/JobTemplate');
const School = require('../models/School');

// @desc    Create a new job template
// @route   POST /api/templates
// @access  Private (School/Admin)
const createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    templateData,
    isPublic
  } = req.body;

  // Get school information
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Create template
  const template = await JobTemplate.create({
    name,
    description,
    category,
    templateData,
    isPublic: isPublic || false,
    createdBy: req.user.id,
    school: school._id
  });

  res.status(201).json({
    success: true,
    message: 'Template created successfully',
    data: template
  });
});

// @desc    Get all templates
// @route   GET /api/templates
// @access  Private
const getTemplates = asyncHandler(async (req, res) => {
  const { category, isPublic, page = 1, limit = 10 } = req.query;

  // Build filter
  const filter = { isActive: true };

  // If user is not admin, only show their school's templates and public templates
  if (req.user.role !== 'admin') {
    const school = await School.findOne({ user: req.user.id });
    if (school) {
      filter.$or = [
        { school: school._id },
        { isPublic: true }
      ];
    } else {
      filter.isPublic = true;
    }
  }

  if (category) {
    filter.category = category;
  }

  if (isPublic !== undefined) {
    filter.isPublic = isPublic === 'true';
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const templates = await JobTemplate.find(filter)
    .populate('createdBy', 'email')
    .populate('school', 'schoolName')
    .sort({ usageCount: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await JobTemplate.countDocuments(filter);

  res.json({
    success: true,
    data: templates,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      limit: parseInt(limit)
    }
  });
});

// @desc    Get single template
// @route   GET /api/templates/:id
// @access  Private
const getTemplate = asyncHandler(async (req, res) => {
  const template = await JobTemplate.findById(req.params.id)
    .populate('createdBy', 'email')
    .populate('school', 'schoolName');

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found'
    });
  }

  // Check if user can access this template
  if (!template.isPublic && req.user.role !== 'admin') {
    const school = await School.findOne({ user: req.user.id });
    if (!school || template.school.toString() !== school._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this template'
      });
    }
  }

  res.json({
    success: true,
    data: template
  });
});

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private (School/Admin)
const updateTemplate = asyncHandler(async (req, res) => {
  const template = await JobTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found'
    });
  }

  // Check if user owns the template or is admin
  if (template.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this template'
    });
  }

  const updatedTemplate = await JobTemplate.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('createdBy', 'email').populate('school', 'schoolName');

  res.json({
    success: true,
    message: 'Template updated successfully',
    data: updatedTemplate
  });
});

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private (School/Admin)
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await JobTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found'
    });
  }

  // Check if user owns the template or is admin
  if (template.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this template'
    });
  }

  await JobTemplate.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Template deleted successfully'
  });
});

// @desc    Use template to create job
// @route   POST /api/templates/:id/use
// @access  Private (School/Admin)
const useTemplate = asyncHandler(async (req, res) => {
  const template = await JobTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found'
    });
  }

  // Check if user can use this template
  if (!template.isPublic && req.user.role !== 'admin') {
    const school = await School.findOne({ user: req.user.id });
    if (!school || template.school.toString() !== school._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to use this template'
      });
    }
  }

  // Increment usage count
  await template.incrementUsage();

  // Return template data for job creation
  res.json({
    success: true,
    message: 'Template data retrieved successfully',
    data: template.templateData
  });
});

// @desc    Get public templates
// @route   GET /api/templates/public
// @access  Public
const getPublicTemplates = asyncHandler(async (req, res) => {
  const { category, limit = 10 } = req.query;

  const filter = {
    isPublic: true,
    isActive: true
  };

  if (category) {
    filter.category = category;
  }

  const templates = await JobTemplate.find(filter)
    .populate('createdBy', 'email')
    .populate('school', 'schoolName')
    .sort({ usageCount: -1, createdAt: -1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: templates
  });
});

// @desc    Get templates by school
// @route   GET /api/templates/school/:schoolId
// @access  Public
const getTemplatesBySchool = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const templates = await JobTemplate.find({
    school: req.params.schoolId,
    isActive: true
  })
    .populate('createdBy', 'email')
    .populate('school', 'schoolName')
    .sort({ usageCount: -1, createdAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  const total = await JobTemplate.countDocuments({
    school: req.params.schoolId,
    isActive: true
  });

  res.json({
    success: true,
    data: templates,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      limit: parseInt(limit)
    }
  });
});

// @desc    Get template categories
// @route   GET /api/templates/categories
// @access  Public
const getTemplateCategories = asyncHandler(async (req, res) => {
  const categories = await JobTemplate.distinct('category', { isActive: true });
  
  res.json({
    success: true,
    data: categories
  });
});

// @desc    Duplicate template
// @route   POST /api/templates/:id/duplicate
// @access  Private (School/Admin)
const duplicateTemplate = asyncHandler(async (req, res) => {
  const originalTemplate = await JobTemplate.findById(req.params.id);

  if (!originalTemplate) {
    return res.status(404).json({
      success: false,
      message: 'Template not found'
    });
  }

  // Check if user can access this template
  if (!originalTemplate.isPublic && req.user.role !== 'admin') {
    const school = await School.findOne({ user: req.user.id });
    if (!school || originalTemplate.school.toString() !== school._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to duplicate this template'
      });
    }
  }

  // Get school information
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Create duplicate
  const duplicate = await JobTemplate.create({
    name: `${originalTemplate.name} (Copy)`,
    description: originalTemplate.description,
    category: originalTemplate.category,
    templateData: originalTemplate.templateData,
    isPublic: false, // Duplicates are always private
    createdBy: req.user.id,
    school: school._id
  });

  res.status(201).json({
    success: true,
    message: 'Template duplicated successfully',
    data: duplicate
  });
});

module.exports = {
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
};




