const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const JobAnalytics = require('../models/JobAnalytics');
const JobApplication = require('../models/JobApplication');
const School = require('../models/School');

// @desc    Get job analytics
// @route   GET /api/analytics/job/:jobId
// @access  Private (School/Admin)
const getJobAnalytics = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if user owns the job or is admin
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view analytics for this job'
    });
  }

  const analytics = await JobAnalytics.findOne({ job: req.params.jobId })
    .populate('job', 'title department')
    .populate('school', 'schoolName');

  if (!analytics) {
    return res.status(404).json({
      success: false,
      message: 'Analytics not found for this job'
    });
  }

  // Get applications data
  const applications = await JobApplication.find({ job: req.params.jobId })
    .populate('applicant', 'email role');

  // Calculate additional metrics
  const applicationStatusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});

  const responseData = {
    ...analytics.toObject(),
    applications: {
      ...analytics.applications,
      statusCounts: applicationStatusCounts,
      totalApplications: applications.length,
      applicationsList: applications
    }
  };

  res.json({
    success: true,
    data: responseData
  });
});

// @desc    Get school analytics dashboard
// @route   GET /api/analytics/school
// @access  Private (School/Admin)
const getSchoolAnalytics = asyncHandler(async (req, res) => {
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({
      success: false,
      message: 'School profile not found'
    });
  }

  // Get all jobs for this school
  const jobs = await Job.find({ school: school._id });
  const jobIds = jobs.map(job => job._id);

  // Get analytics for all jobs
  const analytics = await JobAnalytics.find({ school: school._id })
    .populate('job', 'title department status');

  // Get applications for all jobs
  const applications = await JobApplication.find({ school: school._id })
    .populate('job', 'title department')
    .populate('applicant', 'email role');

  // Calculate aggregate metrics
  const totalViews = analytics.reduce((sum, a) => sum + a.views.total, 0);
  const totalApplications = analytics.reduce((sum, a) => sum + a.applications.total, 0);
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(job => job.status === 'active').length;

  // Calculate conversion rate
  const conversionRate = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(2) : 0;

  // Get top performing jobs
  const topJobs = analytics
    .sort((a, b) => b.views.total - a.views.total)
    .slice(0, 5);

  // Get application status distribution
  const applicationStatusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});

  // Get monthly trends (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthViews = analytics.reduce((sum, a) => {
      const monthViews = a.views.daily.filter(d => 
        d.date >= monthStart && d.date <= monthEnd
      );
      return sum + monthViews.reduce((s, v) => s + v.count, 0);
    }, 0);

    const monthApplications = applications.filter(app => 
      app.appliedAt >= monthStart && app.appliedAt <= monthEnd
    ).length;

    monthlyData.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      views: monthViews,
      applications: monthApplications
    });
  }

  // Count number of interviews scheduled
  const interviewCount = applications.filter(app => app.status === 'interview-scheduled').length;

  res.json({
    success: true,
    data: {
      overview: {
        totalJobs,
        activeJobs,
        totalViews,
        totalApplications,
        conversionRate: parseFloat(conversionRate),
        interviews: interviewCount
      },
      topJobs,
      applicationStatusCounts,
      monthlyTrends: monthlyData,
      recentApplications: applications.slice(0, 10)
    }
  });
});

// @desc    Get admin analytics dashboard
// @route   GET /api/analytics/admin
// @access  Private (Admin only)
const getAdminAnalytics = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  // Get all analytics data
  const allAnalytics = await JobAnalytics.find({})
    .populate('job', 'title department status')
    .populate('school', 'schoolName');

  const allApplications = await JobApplication.find({})
    .populate('job', 'title department')
    .populate('school', 'schoolName')
    .populate('applicant', 'email role');

  const allJobs = await Job.find({});
  const allSchools = await School.find({});

  // Calculate platform-wide metrics
  const totalJobs = allJobs.length;
  const activeJobs = allJobs.filter(job => job.status === 'active').length;
  const totalViews = allAnalytics.reduce((sum, a) => sum + a.views.total, 0);
  const totalApplications = allAnalytics.reduce((sum, a) => sum + a.applications.total, 0);
  const totalSchools = allSchools.length;

  // Calculate conversion rate
  const conversionRate = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(2) : 0;

  // Get top performing schools
  const schoolPerformance = allSchools.map(school => {
    const schoolAnalytics = allAnalytics.filter(a => a.school.toString() === school._id.toString());
    const schoolViews = schoolAnalytics.reduce((sum, a) => sum + a.views.total, 0);
    const schoolApplications = schoolAnalytics.reduce((sum, a) => sum + a.applications.total, 0);
    
    return {
      school: school.schoolName,
      views: schoolViews,
      applications: schoolApplications,
      jobs: schoolAnalytics.length,
      conversionRate: schoolViews > 0 ? ((schoolApplications / schoolViews) * 100).toFixed(2) : 0
    };
  }).sort((a, b) => b.views - a.views).slice(0, 10);

  // Get top performing jobs
  const topJobs = allAnalytics
    .sort((a, b) => b.views.total - a.views.total)
    .slice(0, 10);

  // Get application status distribution
  const applicationStatusCounts = allApplications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});

  // Get monthly trends (last 12 months)
  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthViews = allAnalytics.reduce((sum, a) => {
      const monthViews = a.views.daily.filter(d => 
        d.date >= monthStart && d.date <= monthEnd
      );
      return sum + monthViews.reduce((s, v) => s + v.count, 0);
    }, 0);

    const monthApplications = allApplications.filter(app => 
      app.appliedAt >= monthStart && app.appliedAt <= monthEnd
    ).length;

    const monthJobs = allJobs.filter(job => 
      job.createdAt >= monthStart && job.createdAt <= monthEnd
    ).length;

    monthlyData.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      views: monthViews,
      applications: monthApplications,
      jobs: monthJobs
    });
  }

  res.json({
    success: true,
    data: {
      overview: {
        totalJobs,
        activeJobs,
        totalViews,
        totalApplications,
        totalSchools,
        conversionRate: parseFloat(conversionRate)
      },
      topSchools: schoolPerformance,
      topJobs,
      applicationStatusCounts,
      monthlyTrends: monthlyData,
      recentActivity: {
        recentJobs: allJobs.slice(0, 10),
        recentApplications: allApplications.slice(0, 10)
      }
    }
  });
});

// @desc    Get analytics for specific date range
// @route   GET /api/analytics/range
// @access  Private (School/Admin)
const getAnalyticsByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate, jobId, schoolId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Start date and end date are required'
    });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Build filter
  const filter = {};
  
  if (jobId) {
    filter.job = jobId;
  }
  
  if (schoolId) {
    filter.school = schoolId;
  } else if (req.user.role !== 'admin') {
    // If not admin, only show their school's data
    const school = await School.findOne({ user: req.user.id });
    if (school) {
      filter.school = school._id;
    }
  }

  const analytics = await JobAnalytics.find(filter)
    .populate('job', 'title department')
    .populate('school', 'schoolName');

  // Filter data by date range
  const filteredData = analytics.map(a => {
    const filteredViews = a.views.daily.filter(d => d.date >= start && d.date <= end);
    const filteredApplications = a.applications.daily.filter(d => d.date >= start && d.date <= end);
    
    return {
      ...a.toObject(),
      views: {
        ...a.views,
        daily: filteredViews,
        total: filteredViews.reduce((sum, d) => sum + d.count, 0)
      },
      applications: {
        ...a.applications,
        daily: filteredApplications,
        total: filteredApplications.reduce((sum, d) => sum + d.count, 0)
      }
    };
  });

  res.json({
    success: true,
    data: filteredData
  });
});

// @desc    Export analytics data
// @route   GET /api/analytics/export
// @access  Private (School/Admin)
const exportAnalytics = asyncHandler(async (req, res) => {
  const { format = 'json', jobId, schoolId } = req.query;

  // Build filter
  const filter = {};
  
  if (jobId) {
    filter.job = jobId;
  }
  
  if (schoolId) {
    filter.school = schoolId;
  } else if (req.user.role !== 'admin') {
    // If not admin, only export their school's data
    const school = await School.findOne({ user: req.user.id });
    if (school) {
      filter.school = school._id;
    }
  }

  const analytics = await JobAnalytics.find(filter)
    .populate('job', 'title department')
    .populate('school', 'schoolName');

  if (format === 'csv') {
    // Convert to CSV format
    const csvData = analytics.map(a => ({
      'Job Title': a.job.title,
      'School': a.school.schoolName,
      'Total Views': a.views.total,
      'Total Applications': a.applications.total,
      'Conversion Rate': a.applicationRate,
      'Created At': a.createdAt
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
    
    // Simple CSV conversion
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    res.send(csv);
  } else {
    res.json({
      success: true,
      data: analytics
    });
  }
});

module.exports = {
  getJobAnalytics,
  getSchoolAnalytics,
  getAdminAnalytics,
  getAnalyticsByDateRange,
  exportAnalytics
};




