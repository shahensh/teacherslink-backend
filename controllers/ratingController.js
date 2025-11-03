const mongoose = require('mongoose');
const SchoolRating = require('../models/SchoolRating');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const { asyncHandler } = require('../middleware/errorMiddleware');

// @desc    Submit a rating for a school
// @route   POST /api/ratings
// @access  Private (Teacher)
const submitRating = asyncHandler(async (req, res) => {
  const { schoolId, rating, review, categories, isAnonymous } = req.body;

  console.log('Rating Controller - submitRating called:', {
    schoolId,
    rating,
    review: review?.substring(0, 50) + '...',
    categories,
    isAnonymous,
    teacherId: req.user.id
  });

  // Validate required fields
  if (!schoolId || !rating) {
    return res.status(400).json({
      success: false,
      message: 'School ID and rating are required'
    });
  }

  // Validate rating range
  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be between 1 and 5'
    });
  }

  // Check if school exists
  const school = await School.findById(schoolId);
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School not found'
    });
  }

  // Check if teacher has already rated this school
  const existingRating = await SchoolRating.findOne({
    school: schoolId,
    teacher: req.user.id
  });

  let ratingData;
  if (existingRating) {
    // Update existing rating
    existingRating.rating = rating;
    existingRating.review = review || '';
    existingRating.categories = categories || {};
    existingRating.isAnonymous = isAnonymous || false;
    existingRating.updatedAt = new Date();
    
    ratingData = await existingRating.save();
    console.log('Rating Controller - Updated existing rating:', ratingData._id);
  } else {
    // Create new rating
    ratingData = await SchoolRating.create({
      school: schoolId,
      teacher: req.user.id,
      rating,
      review: review || '',
      categories: categories || {},
      isAnonymous: isAnonymous || false
    });
    console.log('Rating Controller - Created new rating:', ratingData._id);
  }

  // Populate the rating data
  await ratingData.populate([
    { path: 'school', select: 'schoolName' },
    { path: 'teacher', select: 'email' }
  ]);

  // Get updated average rating for the school
  const averageRating = await SchoolRating.getAverageRating(schoolId);

  // Emit real-time update via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`school:${schoolId}`).emit('rating_updated', {
      type: 'rating_updated',
      schoolId: schoolId,
      averageRating: averageRating,
      newRating: {
        _id: ratingData._id,
        rating: ratingData.rating,
        review: ratingData.review,
        categories: ratingData.categories,
        isAnonymous: ratingData.isAnonymous,
        createdAt: ratingData.createdAt,
        updatedAt: ratingData.updatedAt
      },
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    message: existingRating ? 'Rating updated successfully' : 'Rating submitted successfully',
    data: {
      rating: ratingData,
      averageRating: averageRating
    }
  });
});

// @desc    Get ratings for a school
// @route   GET /api/ratings/school/:schoolId
// @access  Public
const getSchoolRatings = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  console.log('Rating Controller - getSchoolRatings called:', { schoolId, page, limit });

  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid school ID'
    });
  }

  try {
    // Get average rating and total count
    const averageRating = await SchoolRating.getAverageRating(schoolId);
    console.log('Rating Controller - Average rating calculated:', averageRating);

    // Get individual ratings with pagination
    const ratings = await SchoolRating.find({ school: schoolId })
      .populate('teacher', 'email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get teacher names separately for teacher users
    const teacherIds = ratings
      .filter(rating => rating.teacher && rating.teacher.role === 'teacher')
      .map(rating => rating.teacher._id);

    let teacherProfiles = [];
    if (teacherIds.length > 0) {
      const Teacher = require('../models/Teacher');
      teacherProfiles = await Teacher.find({ user: { $in: teacherIds } })
        .select('user personalInfo.firstName personalInfo.lastName');
    }

    // Map teacher profiles to ratings
    ratings.forEach(rating => {
      if (rating.teacher && rating.teacher.role === 'teacher') {
        const teacherProfile = teacherProfiles.find(profile => 
          profile.user.toString() === rating.teacher._id.toString()
        );
        if (teacherProfile) {
          rating.teacher.teacherProfile = teacherProfile;
        }
      }
    });

    const totalRatings = await SchoolRating.countDocuments({ school: schoolId });

    console.log('Rating Controller - Found ratings:', {
      totalRatings,
      averageRating: averageRating.averageRating,
      ratingsCount: ratings.length
    });

    res.json({
      success: true,
      data: {
        averageRating,
        ratings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalRatings / limit),
          total: totalRatings
        }
      }
    });
  } catch (error) {
    console.error('Rating Controller - Error in getSchoolRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// @desc    Get teacher's rating for a school
// @route   GET /api/ratings/school/:schoolId/teacher
// @access  Private (Teacher)
const getTeacherRating = asyncHandler(async (req, res) => {
  const { schoolId } = req.params;

  console.log('Rating Controller - getTeacherRating called:', { schoolId, teacherId: req.user.id });

  const rating = await SchoolRating.findOne({
    school: schoolId,
    teacher: req.user.id
  }).populate('school', 'schoolName');

  res.json({
    success: true,
    data: rating
  });
});

// @desc    Delete teacher's rating
// @route   DELETE /api/ratings/:ratingId
// @access  Private (Teacher)
const deleteRating = asyncHandler(async (req, res) => {
  const { ratingId } = req.params;

  console.log('Rating Controller - deleteRating called:', { ratingId, teacherId: req.user.id });

  const rating = await SchoolRating.findOneAndDelete({
    _id: ratingId,
    teacher: req.user.id
  });

  if (!rating) {
    return res.status(404).json({
      success: false,
      message: 'Rating not found or not authorized to delete'
    });
  }

  // Get updated average rating for the school
  const averageRating = await SchoolRating.getAverageRating(rating.school);

  // Emit real-time update via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`school:${rating.school}`).emit('rating_updated', {
      type: 'rating_updated',
      schoolId: rating.school,
      averageRating: averageRating,
      deletedRating: ratingId,
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    message: 'Rating deleted successfully',
    data: {
      averageRating: averageRating
    }
  });
});

module.exports = {
  submitRating,
  getSchoolRatings,
  getTeacherRating,
  deleteRating
};
