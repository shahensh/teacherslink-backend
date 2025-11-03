const asyncHandler = require('express-async-handler');
const Teacher = require('../models/Teacher');
const School = require('../models/School');

// Search all profiles (teachers and schools)
const searchProfiles = asyncHandler(async (req, res) => {
  try {
    const { q: query, page = 1, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        profiles: [],
        suggestions: [],
        total: 0
      });
    }

    const searchTerm = query.trim();
    const skip = (page - 1) * limit;

    // Search teachers
    const teacherQuery = {
      $or: [
        { 'personalInfo.firstName': { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.bio': { $regex: searchTerm, $options: 'i' } },
        { 'professionalInfo.specialization': { $in: [new RegExp(searchTerm, 'i')] } }
      ]
    };

    const teacherResults = await Teacher.find(teacherQuery)
      .populate('user', 'email plan')
      .select('personalInfo professionalInfo slug createdAt')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    // Search schools
    const schoolQuery = {
      $or: [
        { schoolName: { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const schoolResults = await School.find(schoolQuery)
      .populate('user', 'email plan')
      .select('schoolName description location slug profileImage createdAt')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    // Format results
    const formattedTeachers = teacherResults.map(teacher => ({
      _id: teacher._id,
      userId: teacher.user?._id || teacher.user,
      type: 'teacher',
      name: teacher.personalInfo ? `${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}` : 'Teacher',
      slug: teacher.slug,
      profileImage: teacher.personalInfo?.profileImage || teacher.personalInfo?.profilePhoto,
      bio: teacher.personalInfo?.bio,
      professionalInfo: teacher.professionalInfo,
      createdAt: teacher.createdAt
    }));

    const formattedSchools = schoolResults.map(school => ({
      _id: school._id,
      userId: school.user?._id || school.user,
      type: 'school',
      name: school.schoolName,
      slug: school.slug,
      profileImage: school.profileImage,
      bio: school.description,
      location: school.location,
      createdAt: school.createdAt,
      plan: school.user?.plan || null
    }));

    // Combine and sort results
    const allResults = [...formattedTeachers, ...formattedSchools]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get suggestions (recent profiles)
    const suggestions = await getSearchSuggestionsHelper(searchTerm);

    res.json({
      success: true,
      profiles: allResults,
      suggestions,
      total: allResults.length
    });

  } catch (error) {
    console.error('Search profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search profiles'
    });
  }
});

// Search teachers only
const searchTeachers = asyncHandler(async (req, res) => {
  try {
    const { q: query, page = 1, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        profiles: [],
        total: 0
      });
    }

    const searchTerm = query.trim();
    const skip = (page - 1) * limit;

    const teacherQuery = {
      $or: [
        { 'personalInfo.firstName': { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.bio': { $regex: searchTerm, $options: 'i' } },
        { 'professionalInfo.specialization': { $in: [new RegExp(searchTerm, 'i')] } }
      ]
    };

    const teacherResults = await Teacher.find(teacherQuery)
      .populate('user', 'email plan')
      .select('personalInfo professionalInfo slug createdAt')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const formattedTeachers = teacherResults.map(teacher => ({
      _id: teacher._id,
      userId: teacher.user?._id || teacher.user,
      type: 'teacher',
      name: teacher.personalInfo ? `${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}` : 'Teacher',
      slug: teacher.slug,
      profileImage: teacher.personalInfo?.profileImage || teacher.personalInfo?.profilePhoto,
      bio: teacher.personalInfo?.bio,
      professionalInfo: teacher.professionalInfo,
      createdAt: teacher.createdAt
    }));

    res.json({
      success: true,
      profiles: formattedTeachers,
      total: formattedTeachers.length
    });

  } catch (error) {
    console.error('Search teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search teachers'
    });
  }
});

// Search schools only
const searchSchools = asyncHandler(async (req, res) => {
  try {
    const { q: query, page = 1, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        profiles: [],
        total: 0
      });
    }

    const searchTerm = query.trim();
    const skip = (page - 1) * limit;

    const schoolQuery = {
      $or: [
        { schoolName: { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const schoolResults = await School.find(schoolQuery)
      .populate('user', 'email plan')
      .select('schoolName description location slug profileImage createdAt')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const formattedSchools = schoolResults.map(school => ({
      _id: school._id,
      userId: school.user?._id || school.user,
      type: 'school',
      name: school.schoolName,
      slug: school.slug,
      profileImage: school.profileImage,
      bio: school.description,
      location: school.location,
      createdAt: school.createdAt,
      plan: school.user?.plan || null
    }));

    res.json({
      success: true,
      profiles: formattedSchools,
      total: formattedSchools.length
    });

  } catch (error) {
    console.error('Search schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search schools'
    });
  }
});

// Get search suggestions
const getSearchSuggestions = asyncHandler(async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = await getSearchSuggestions(query.trim());

    res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions'
    });
  }
});

// Helper function to get search suggestions
const getSearchSuggestionsHelper = async (searchTerm) => {
  try {
    // Get recent teachers and schools that match the search term
    const teacherQuery = {
      $or: [
        { 'personalInfo.firstName': { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const schoolQuery = {
      $or: [
        { schoolName: { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const [recentTeachers, recentSchools] = await Promise.all([
      Teacher.find(teacherQuery)
        .populate('user', 'email plan')
        .select('personalInfo slug createdAt')
        .limit(5)
        .sort({ createdAt: -1 }),
      School.find(schoolQuery)
        .populate('user', 'email plan')
        .select('schoolName slug profileImage createdAt')
        .limit(5)
        .sort({ createdAt: -1 })
    ]);

    const formattedTeachers = recentTeachers.map(teacher => ({
      _id: teacher._id,
      userId: teacher.user?._id || teacher.user,
      type: 'teacher',
      name: teacher.personalInfo ? `${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}` : 'Teacher',
      slug: teacher.slug,
      profileImage: teacher.personalInfo?.profileImage || teacher.personalInfo?.profilePhoto,
      createdAt: teacher.createdAt
    }));

    const formattedSchools = recentSchools.map(school => ({
      _id: school._id,
      userId: school.user?._id || school.user,
      type: 'school',
      name: school.schoolName,
      slug: school.slug,
      profileImage: school.profileImage,
      createdAt: school.createdAt,
      plan: school.user?.plan || null
    }));

    return [...formattedTeachers, ...formattedSchools]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

  } catch (error) {
    console.error('Get suggestions helper error:', error);
    return [];
  }
};

module.exports = {
  searchProfiles,
  searchTeachers,
  searchSchools,
  getSearchSuggestions
};
