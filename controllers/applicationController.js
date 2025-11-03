const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const JobAnalytics = require('../models/JobAnalytics');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getFileInfo } = require('../middleware/fileUpload');

// @desc    Submit a job application
// @route   POST /api/applications
// @access  Private (Teacher)
const submitApplication = asyncHandler(async (req, res) => {
  const { jobId, coverLetter } = req.body;

  console.log('Submit Application - Request body:', req.body);
  console.log('Submit Application - jobId:', jobId, typeof jobId);

  if (!jobId || jobId === 'undefined' || jobId === 'null') {
    return res.status(400).json({ success: false, message: 'jobId is required and must be valid' });
  }

  // Validate that jobId is a valid MongoDB ObjectId format
  if (!/^[0-9a-fA-F]{24}$/.test(jobId)) {
    return res.status(400).json({ success: false, message: 'Invalid jobId format' });
  }

  const job = await Job.findById(jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  if (job.status !== 'active' || !job.isActive) {
    return res.status(400).json({ success: false, message: 'Job is not available for applications' });
  }

  // Ensure one application per user per job (unique index exists)
  try {
    console.log('Submit Application - req.file:', req.file);
    console.log('Submit Application - req.files:', req.files);
    console.log('Submit Application - req.body:', req.body);
    
    // Process uploaded files - check req.files.resume since we're using upload.fields()
    const resumeFile = req.files && req.files.resume ? req.files.resume[0] : null;
    const resumeInfo = resumeFile ? getFileInfo(resumeFile) : null;
    console.log('Submit Application - resumeFile:', resumeFile);
    console.log('Submit Application - resumeInfo:', resumeInfo);
    
    // Process portfolio files if any
    let portfolioInfo = null;
    if (req.files && req.files.portfolio && req.files.portfolio.length > 0) {
      portfolioInfo = {
        url: req.files.portfolio[0].path,
        filename: req.files.portfolio[0].originalname,
        uploadedAt: new Date()
      };
    }

    // Process additional documents if any
    let additionalDocsInfo = [];
    if (req.files && req.files.documents && req.files.documents.length > 0) {
      additionalDocsInfo = req.files.documents.map(doc => ({
        name: doc.originalname,
        url: doc.path,
        filename: doc.filename,
        uploadedAt: new Date()
      }));
    }

    // Create the application with proper file information
    const applicationData = {
      job: job._id,
      school: job.school,
      applicant: req.user.id,
      coverLetter,
      status: 'submitted',
      appliedAt: new Date(),
    };

    // Add resume info if uploaded
    if (resumeInfo) {
      applicationData.resume = {
        url: resumeInfo.url,
        filename: resumeInfo.filename,
        uploadedAt: resumeInfo.uploadedAt
      };
    }

    // Add portfolio info if uploaded
    if (portfolioInfo) {
      applicationData.portfolio = portfolioInfo;
    }

    // Add additional documents if uploaded
    if (additionalDocsInfo.length > 0) {
      applicationData.additionalDocuments = additionalDocsInfo;
    }

    const application = await JobApplication.create(applicationData);

    // Update analytics counts if present
    const analytics = await JobAnalytics.findOne({ job: job._id });
    if (analytics) {
      analytics.applications.total = (analytics.applications.total || 0) + 1;
      analytics.applications.daily = analytics.applications.daily || [];
      analytics.applications.daily.push({ date: new Date(), count: 1 });
      await analytics.save();
    }

    // Emit realtime event to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('application_submitted', {
        _id: application._id,
        jobId: job._id,
        jobTitle: job.title,
        schoolId: job.school,
        applicant: { _id: req.user.id },
        status: application.status,
        appliedAt: application.appliedAt,
      });
      console.log('Emitted application_submitted event for job:', job.title);
    }

    return res.status(201).json({ success: true, message: 'Application submitted', data: application });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ success: false, message: 'You already applied to this job' });
    }
    throw err;
  }
});
 
// @desc    List current teacher's applications
// @route   GET /api/applications/my
// @access  Private (Teacher)
const listMyApplications = asyncHandler(async (req, res) => {
  const apps = await JobApplication.find({ applicant: req.user.id })
    .populate('job', 'title department location salary createdAt')
    .populate('school', 'schoolName')
    .sort({ appliedAt: -1 });
  res.json({ success: true, data: apps });
});

// @desc    Check if user has applied to a specific job
// @route   GET /api/applications/check/:jobId
// @access  Private (Teacher)
const checkApplicationStatus = asyncHandler(async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('checkApplicationStatus - jobId:', jobId, 'userId:', req.user.id);
    
    // Validate jobId format
    if (!jobId || jobId === 'undefined' || jobId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    const application = await JobApplication.findOne({ 
      applicant: req.user.id, 
      job: jobId 
    }).select('_id status appliedAt');
    
    console.log('checkApplicationStatus - found application:', application);
    
    res.json({ 
      success: true, 
      data: { 
        hasApplied: !!application,
        application: application || null
      } 
    });
  } catch (error) {
    console.error('checkApplicationStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking application status'
    });
  }
});

// @desc    Get school applications
// @route   GET /api/applications/school
// @access  Private (School)
const getSchoolApplications = asyncHandler(async (req, res) => {
  // Find the school associated with this user
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({ success: false, message: 'School profile not found' });
  }

  // First, let's check what teachers exist in the database
  const allTeachers = await Teacher.find({}).select('user personalInfo.firstName personalInfo.lastName personalInfo.address slug');
  console.log('All teachers in database:', allTeachers.length);
  console.log('Sample teachers:', allTeachers.slice(0, 3).map(t => ({ 
    id: t._id, 
    user: t.user, 
    name: t.personalInfo?.firstName,
    hasAddress: !!t.personalInfo?.address?.city
  })));

  // Also check what users exist with teacher role
  const teacherUsers = await User.find({ role: 'teacher' }).select('_id email firstName lastName');
  console.log('Teacher users in database:', teacherUsers.length);
  console.log('Sample teacher users:', teacherUsers.slice(0, 3).map(u => ({
    id: u._id,
    email: u.email,
    name: u.firstName
  })));

  const applications = await JobApplication.find({ school: school._id })
    .populate('job', 'title department location salary')
    .populate({
      path: 'applicant',
      select: 'email firstName lastName role address'
    })
    .sort({ appliedAt: -1 });

  console.log('Found applications:', applications.length);
  console.log('Sample applicants:', applications.slice(0, 3).map(app => ({
    id: app._id,
    applicantId: app.applicant?._id,
    applicantRole: app.applicant?.role,
    applicantEmail: app.applicant?.email
  })));

  // Create a map of user IDs to teacher profiles for efficient lookup
  const teacherMap = new Map();
  allTeachers.forEach(teacher => {
    if (teacher.user) {
      teacherMap.set(teacher.user.toString(), teacher);
    }
  });
  console.log('Teacher map created with', teacherMap.size, 'entries');

  // Get message counts for each application
  const Message = require('../models/Message');
  const messageCounts = await Message.aggregate([
    {
      $match: {
        application: { $in: applications.map(app => app._id) },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$application',
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Create a map of application ID to message count
  const messageCountMap = new Map();
  messageCounts.forEach(item => {
    messageCountMap.set(item._id.toString(), item.count);
  });
  console.log('Message counts loaded for', messageCountMap.size, 'applications');

  // Manually populate teacher profiles for teacher applicants
  const applicationsWithTeachers = await Promise.all(
    applications.map(async (app) => {
      console.log('Processing application:', app._id, 'Applicant role:', app.applicant?.role, 'Applicant ID:', app.applicant?._id);
      
      // Add message count to application
      const messageCount = messageCountMap.get(app._id.toString()) || 0;
      app._doc.messageCount = messageCount;
      
      if (app.applicant?.role === 'teacher') {
        console.log('Looking for teacher with user ID:', app.applicant._id);
        console.log('Teacher map keys:', Array.from(teacherMap.keys()));
        console.log('Looking for key:', app.applicant._id.toString());
        
        // Try to find teacher using the map
        const teacher = teacherMap.get(app.applicant._id.toString());
        
        if (teacher) {
          console.log('Found teacher via map:', teacher._id, 'Name:', teacher.personalInfo?.firstName);
          app.applicant.teacher = teacher;
        } else {
          console.log('No teacher found for user:', app.applicant._id);
          console.log('Available teacher user IDs in map:', Array.from(teacherMap.keys()));
          
          // Try direct database lookup as fallback
          const directTeacher = await Teacher.findOne({ user: app.applicant._id })
            .select('personalInfo.firstName personalInfo.lastName personalInfo.profileImage personalInfo.address slug');
          if (directTeacher) {
            console.log('Found teacher via direct lookup:', directTeacher._id);
            app.applicant.teacher = directTeacher;
          } else {
            console.log('No teacher profile found in database for user:', app.applicant._id);
            // Check if this user exists in the users collection
            const userExists = await User.findById(app.applicant._id);
            console.log('User exists in users collection:', !!userExists, userExists?.email);
          }
        }
      }
      return app;
    })
  );
  
  console.log('getSchoolApplications - Found applications:', applicationsWithTeachers.length);
  console.log('getSchoolApplications - Applications data:', applicationsWithTeachers.map(app => ({
    id: app._id,
    applicant: app.applicant?.email,
    job: app.job?.title,
    resume: app.resume ? 'Has resume' : 'No resume',
    resumeUrl: app.resume?.url,
    teacherProfile: app.applicant?.teacher ? 'Has teacher profile' : 'No teacher profile',
    teacherName: app.applicant?.teacher?.personalInfo?.firstName,
    teacherLocation: app.applicant?.teacher?.personalInfo?.address?.city
  })));
  
  // Log final results
  const teachersFound = applicationsWithTeachers.filter(app => app.applicant?.teacher).length;
  console.log(`Successfully populated ${teachersFound} out of ${applicationsWithTeachers.length} teacher profiles`);
  
  res.json({ success: true, data: applicationsWithTeachers });
});

// @desc    Debug endpoint to check teacher profiles
// @route   GET /api/applications/debug-teachers
// @access  Private (School)
const debugTeachers = asyncHandler(async (req, res) => {
  console.log('=== DEBUG TEACHERS ENDPOINT ===');
  
  // Get all users with teacher role
  const teacherUsers = await User.find({ role: 'teacher' }).select('_id email firstName lastName');
  console.log('Teacher users:', teacherUsers.length);
  console.log('Sample teacher users:', teacherUsers.slice(0, 3));
  
  // Get all teacher profiles
  const teacherProfiles = await Teacher.find({}).select('user personalInfo.firstName personalInfo.lastName personalInfo.address');
  console.log('Teacher profiles:', teacherProfiles.length);
  console.log('Sample teacher profiles:', teacherProfiles.slice(0, 3));
  
  // Check if there are users without teacher profiles
  const usersWithoutProfiles = teacherUsers.filter(user => 
    !teacherProfiles.some(profile => profile.user.toString() === user._id.toString())
  );
  console.log('Users without teacher profiles:', usersWithoutProfiles.length);
  console.log('Sample users without profiles:', usersWithoutProfiles.slice(0, 3));
  
  res.json({
    success: true,
    data: {
      teacherUsers: teacherUsers.length,
      teacherProfiles: teacherProfiles.length,
      usersWithoutProfiles: usersWithoutProfiles.length,
      sampleUsers: teacherUsers.slice(0, 3),
      sampleProfiles: teacherProfiles.slice(0, 3),
      usersWithoutProfiles: usersWithoutProfiles.slice(0, 3)
    }
  });
});

// @desc    Get single application by ID
// @route   GET /api/applications/:id
// @access  Private (School, Teacher, Admin)
const getApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('getApplication - Request received:', {
    applicationId: id,
    userId: req.user?.id,
    userRole: req.user?.role
  });

  const application = await JobApplication.findById(id)
    .populate('job', 'title department location salary')
    .populate('applicant', 'email firstName lastName')
    .populate('school', 'schoolName');

  if (!application) {
    console.log('getApplication - Application not found for ID:', id);
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  console.log('getApplication - Application found with resume:', {
    applicationId: application._id,
    resume: application.resume ? 'Has resume' : 'No resume',
    resumeUrl: application.resume?.url,
    resumeFilename: application.resume?.filename
  });

  console.log('getApplication - Application found:', {
    applicationId: application._id,
    applicantId: application.applicant,
    schoolId: application.school,
    jobId: application.job
  });

  // Check permissions
  const isAdmin = req.user.role === 'admin';
  const isApplicant = application.applicant?.toString() === req.user.id;
  
  // For school users, check if they own this application
  let isSchoolOwner = false;
  if (req.user.role === 'school') {
    console.log('getApplication - Looking up school for user:', req.user.id);
    const school = await School.findOne({ user: req.user.id });
    console.log('getApplication - School found:', school);
    
    if (school) {
      // Handle both populated and non-populated school references
      const applicationSchoolId = application.school?._id?.toString() || application.school?.toString();
      console.log('getApplication - Comparing school IDs:', {
        applicationSchoolId: applicationSchoolId,
        userSchoolId: school._id.toString(),
        applicationSchoolObject: application.school
      });
      isSchoolOwner = applicationSchoolId === school._id.toString();
    }
  }

  console.log('getApplication - Authorization check:', {
    userId: req.user.id,
    userRole: req.user.role,
    applicantId: application.applicant?.toString(),
    schoolId: application.school?.toString(),
    isAdmin,
    isApplicant,
    isSchoolOwner
  });

  if (!isAdmin && !isApplicant && !isSchoolOwner) {
    console.log('getApplication - ACCESS DENIED - Authorization failed');
    console.log('getApplication - User ID:', req.user.id);
    console.log('getApplication - Application School ID:', application.school?.toString());
    // Fix: Use the school variable that was declared in the if block above
    if (req.user.role === 'school') {
      const schoolForDebug = await School.findOne({ user: req.user.id });
      console.log('getApplication - User School ID:', schoolForDebug?._id?.toString());
      console.log('getApplication - School match:', application.school?.toString() === schoolForDebug?._id?.toString());
    }
    return res.status(403).json({ success: false, message: 'Not authorized to view this application' });
  } else {
    console.log('getApplication - ACCESS GRANTED - User authorized');
  }

  res.json({ success: true, data: application });
});

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private (School)
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, updatedBy } = req.body;

  const application = await JobApplication.findById(id);
  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  // Find the school associated with this user
  const school = await School.findOne({ user: req.user.id });
  if (!school) {
    return res.status(404).json({ success: false, message: 'School profile not found' });
  }

  // Check if user has permission to update this application
  if (application.school.toString() !== school._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this application' });
  }

  // Update status
  application.status = status;
  application.updatedAt = new Date();
  application.updatedBy = updatedBy || 'school';
  
  await application.save();

  // Emit stats update for home page if status is accepted/hired
  if (global.io && (status === 'accepted' || status === 'hired')) {
    const successfulHires = await JobApplication.countDocuments({ 
      status: { $in: ['accepted', 'hired'] } 
    });
    global.io.emit('stats_updated', { successfulHires });
    console.log('Emitted successful hires update:', successfulHires);
  }

  // Create notification for teacher
  let notificationTitle, notificationMessage, notificationType;
  
  if (status === 'shortlisted') {
    notificationTitle = '🎉 Congratulations! You\'ve been shortlisted!';
    notificationMessage = `Your application has been shortlisted by ${school.schoolName}. They are interested in your profile and may contact you soon.`;
    notificationType = 'shortlist';
  } else if (status === 'rejected') {
    notificationTitle = 'Application Update';
    notificationMessage = `Thank you for your interest. Unfortunately, your application was not selected by ${school.schoolName} this time. Keep applying to other opportunities!`;
    notificationType = 'reject';
  } else if (status === 'interview_scheduled' || status === 'interviewed') {
    notificationTitle = '📅 Interview Scheduled!';
    notificationMessage = `Great news! ${school.schoolName} has scheduled an interview with you. Check your email for details.`;
    notificationType = 'interview';
  } else if (status === 'accepted' || status === 'hired') {
    notificationTitle = '🎊 Congratulations! You\'ve been hired!';
    notificationMessage = `Excellent news! ${school.schoolName} has accepted your application. You\'ve been hired for the position!`;
    notificationType = 'hired';
  }

  // Create notification if it's a status that should notify the teacher
  if (notificationTitle && notificationMessage) {
    // Populate job data to get the actual job title
    const populatedApplication = await JobApplication.findById(application._id)
      .populate('job', 'title')
      .populate('school', 'schoolName');
    
    const notification = await Notification.create({
      user: application.applicant,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      data: {
        jobId: application.job.toString(),
        schoolId: school._id.toString(),
        applicationId: application._id.toString(),
        schoolName: school.schoolName,
        jobTitle: populatedApplication?.job?.title || 'Position'
      }
    });

    // Emit real-time notification via Socket.IO with mobile popup support and push notifications
    const io = req.app.get('io');
    if (io) {
      const { emitNotification } = require('../utils/notificationHelper');
      
      // Emit notification with platform-specific formatting (popup for mobile) and push notification
      await emitNotification(io, application.applicant.toString(), {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        user: application.applicant.toString()
      }, { 
        forcePopup: true, // Force popup for important status changes
        sendPush: true    // Send push notification (works even when app is closed)
      });

      // Also emit the legacy application status update event
      io.to(`user_${application.applicant}`).emit('application_status_updated', {
        applicationId: application._id,
        status: status,
        updatedAt: application.updatedAt,
        updatedBy: application.updatedBy
      });
    }
  }

  res.json({ 
    success: true, 
    message: 'Application status updated successfully',
    data: application 
  });
});

// @desc    Get resume file (proxy for Cloudinary)
// @route   GET /api/applications/:id/resume
// @access  Private
const getResumeFile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const application = await JobApplication.findById(id)
    .populate('school', 'user')
    .populate('applicant', 'user');
  
  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  // Check if user has permission to view this resume
  // Allow access if user is admin, school role, or the actual applicant
  const isAdmin = req.user.role === 'admin';
  const isSchoolRole = req.user.role === 'school';
  const isApplicant = application.applicant?.user?.toString() === req.user.id;

  console.log('Resume access check:', {
    userId: req.user.id,
    userRole: req.user.role,
    applicantUserId: application.applicant?.user?.toString(),
    isApplicant: isApplicant,
    isAdmin: isAdmin,
    isSchoolRole: isSchoolRole
  });

  if (!isSchoolRole && !isApplicant && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Not authorized to view this resume' });
  }

  if (!application.resume?.url) {
    return res.status(404).json({ success: false, message: 'Resume not found' });
  }

  try {
    // Get the Cloudinary URL and filename
    const resumeUrl = application.resume.url;
    const filename = application.resume.filename || 'resume.pdf';
    
    console.log('Original resume URL:', resumeUrl);
    console.log('Resume filename:', filename);

    // Make the Cloudinary URL public by adding transformation parameters
    const publicUrl = resumeUrl.includes('?') 
      ? `${resumeUrl}&fl_inline&f_pdf`
      : `${resumeUrl}?fl_inline&f_pdf`;
    
    console.log('Original URL:', resumeUrl);
    console.log('Public URL:', publicUrl);
    
    // Try to fetch and stream the PDF with proper error handling
    const axios = require('axios');
    
    try {
      console.log('Fetching PDF from Cloudinary...');
      
      // Try with different approaches
      const urlsToTry = [
        publicUrl, // With fl_inline&f_pdf
        resumeUrl, // Original URL
        resumeUrl.replace('/upload/', '/upload/fl_inline,f_pdf/') // Cloudinary transformation syntax
      ];
      
      let pdfResponse = null;
      let lastError = null;
      
      for (const url of urlsToTry) {
        try {
          console.log('Trying URL:', url);
          pdfResponse = await axios.get(url, {
            responseType: 'stream',
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            validateStatus: function (status) {
              return status >= 200 && status < 400;
            }
          });
          console.log('Success with URL:', url);
          break;
        } catch (error) {
          console.log('Failed with URL:', url, 'Error:', error.response?.status);
          lastError = error;
        }
      }
      
      if (!pdfResponse) {
        throw lastError;
      }

      console.log('PDF response status:', pdfResponse.status);
      console.log('PDF response headers:', pdfResponse.headers);

      // Set proper headers for PDF viewing
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');

      console.log('Streaming PDF to client...');
      // Pipe the PDF stream to the response
      pdfResponse.data.pipe(res);
      
    } catch (streamError) {
      console.error('Streaming failed:', streamError.message);
      console.error('Stream error details:', streamError.response?.status, streamError.response?.data);
      
      // Fallback: return JSON with error and public URL
      console.log('Returning fallback response with public URL:', publicUrl);
      return res.json({
        success: false,
        message: 'Failed to stream PDF, using direct URL',
        resumeUrl: publicUrl,
        filename: filename
      });
    }
    
  } catch (error) {
    console.error('Error serving resume:', error.message);
    
    // Return the Cloudinary URL for direct access as fallback
    const resumeUrl = application.resume.url;
    res.json({
      success: false,
      message: 'Failed to process PDF URL',
      resumeUrl: resumeUrl,
      filename: application.resume.filename || 'resume.pdf'
    });
  }
});

// @desc    Create a general inquiry application
// @route   POST /api/applications/create
// @access  Private (Teacher)
const createApplication = asyncHandler(async (req, res) => {
  const { school, job, coverLetter, resume } = req.body;

  console.log('Create Application - Request body:', req.body);

  if (!school) {
    return res.status(400).json({ success: false, message: 'School is required' });
  }

  // Find the school
  const schoolDoc = await School.findById(school);
  if (!schoolDoc) {
    return res.status(404).json({ success: false, message: 'School not found' });
  }

  // Check if there's already an application between this teacher and school
  const existingApplication = await JobApplication.findOne({
    applicant: req.user.id,
    school: school,
    job: job || null
  });

  if (existingApplication) {
    console.log('Create Application - Found existing application:', existingApplication._id);
    return res.status(200).json({
      success: true,
      message: 'Application already exists',
      application: existingApplication
    });
  }

  // Create the application
  const application = new JobApplication({
    job: job || null, // Can be null for general inquiries
    applicant: req.user.id,
    school: school,
    coverLetter: coverLetter || 'General inquiry about job opportunities',
    status: 'submitted', // Use valid enum value
    appliedAt: new Date()
  });

  await application.save();

  // Populate the application with school and job details
  await application.populate([
    { path: 'school', select: 'schoolName user' },
    { path: 'job', select: 'title department' },
    { path: 'applicant', select: 'email role' }
  ]);

  console.log('Create Application - Created application:', application._id);

  res.status(201).json({
    success: true,
    message: 'Application created successfully',
    application: application
  });
});

// @desc    Update application details (including interview details)
// @route   PUT /api/applications/:id
// @access  Private (School)
const updateApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  console.log('Update Application - ID:', id);
  console.log('Update Application - Update Data:', updateData);

  // Find the application
  const application = await JobApplication.findById(id)
    .populate('school', 'schoolName user')
    .populate('applicant', 'email role')
    .populate('job', 'title department');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  // Check if the user is authorized to update this application
  const isSchool = application.school.user.toString() === req.user.id;
  if (!isSchool) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this application'
    });
  }

  // Update the application
  const updatedApplication = await JobApplication.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate([
    { path: 'school', select: 'schoolName user' },
    { path: 'job', select: 'title department' },
    { path: 'applicant', select: 'email role' }
  ]);

  console.log('Update Application - Updated successfully:', updatedApplication._id);

  res.json({
    success: true,
    message: 'Application updated successfully',
    data: updatedApplication
  });
});

module.exports = {
  submitApplication,
  listMyApplications,
  checkApplicationStatus,
  getSchoolApplications,
  getApplication,
  updateApplicationStatus,
  updateApplication,
  getResumeFile,
  debugTeachers,
  createApplication
};


