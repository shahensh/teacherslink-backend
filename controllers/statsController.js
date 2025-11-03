const User = require('../models/User');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const { asyncHandler } = require('../middleware/errorMiddleware');

// @desc    Get public platform statistics for home page
// @route   GET /api/stats/public
// @access  Public
const getPublicStats = asyncHandler(async (req, res) => {
  console.log('📊 Stats API called');
  
  // Count active jobs
  const activeJobs = await Job.countDocuments({ status: 'active' });
  console.log('Active Jobs:', activeJobs);
  
  // Count total teachers
  const totalTeachers = await Teacher.countDocuments();
  console.log('Total Teachers:', totalTeachers);
  
  // Count total schools
  const totalSchools = await School.countDocuments();
  console.log('Total Schools:', totalSchools);
  
  // Count successful hires (accepted/hired applications)
  const successfulHires = await JobApplication.countDocuments({ 
    status: { $in: ['accepted', 'hired'] } 
  });
  console.log('Successful Hires:', successfulHires);

  const stats = {
    activeJobs,
    totalTeachers,
    totalSchools,
    successfulHires
  };

  console.log('✅ Returning stats:', stats);

  res.json({
    success: true,
    stats
  });
});

module.exports = {
  getPublicStats
};


