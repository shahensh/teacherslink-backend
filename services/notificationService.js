const nodemailer = require('nodemailer');
const User = require('../models/User');
const School = require('../models/School');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');

class NotificationService {
  constructor() {
    // Configure email transporter
    this.transporter = nodemailer.createTransporter({
      service: 'gmail', // or your preferred email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Send email notification
  async sendEmail(to, subject, html, text) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@teacherslink.com',
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      return result;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  // Send job application notification to school
  async notifyJobApplication(applicationId) {
    try {
      const application = await JobApplication.findById(applicationId)
        .populate('job', 'title department')
        .populate('school', 'schoolName contactInfo')
        .populate('applicant', 'email');

      if (!application) {
        throw new Error('Application not found');
      }

      const school = application.school;
      const job = application.job;
      const applicant = application.applicant;

      const subject = `New Application for ${job.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Job Application</h2>
          <p>Hello ${school.schoolName},</p>
          <p>You have received a new application for the position: <strong>${job.title}</strong></p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">Application Details</h3>
            <p><strong>Applicant:</strong> ${applicant.email}</p>
            <p><strong>Position:</strong> ${job.title}</p>
            <p><strong>Department:</strong> ${job.department}</p>
            <p><strong>Applied:</strong> ${new Date(application.appliedAt).toLocaleDateString()}</p>
          </div>
          
          <p>Please log in to your dashboard to review the application and take further action.</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL}/school/applications" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              View Application
            </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from Teachers Link. Please do not reply to this email.
          </p>
        </div>
      `;

      const text = `
        New Job Application
        
        Hello ${school.schoolName},
        
        You have received a new application for the position: ${job.title}
        
        Application Details:
        - Applicant: ${applicant.email}
        - Position: ${job.title}
        - Department: ${job.department}
        - Applied: ${new Date(application.appliedAt).toLocaleDateString()}
        
        Please log in to your dashboard to review the application.
        ${process.env.FRONTEND_URL}/school/applications
      `;

      await this.sendEmail(school.contactInfo.email, subject, html, text);
      
      return { success: true, message: 'Application notification sent' };
    } catch (error) {
      console.error('Failed to send application notification:', error);
      throw error;
    }
  }

  // Send application status update to applicant
  async notifyApplicationStatusUpdate(applicationId, newStatus) {
    try {
      const application = await JobApplication.findById(applicationId)
        .populate('job', 'title department')
        .populate('school', 'schoolName')
        .populate('applicant', 'email');

      if (!application) {
        throw new Error('Application not found');
      }

      const school = application.school;
      const job = application.job;
      const applicant = application.applicant;

      const statusMessages = {
        'under-review': 'Your application is now under review',
        'shortlisted': 'Congratulations! You have been shortlisted',
        'interview-scheduled': 'An interview has been scheduled',
        'interviewed': 'Thank you for completing the interview',
        'accepted': 'Congratulations! Your application has been accepted',
        'rejected': 'Thank you for your interest, but your application was not selected'
      };

      const subject = `Application Update: ${job.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Application Status Update</h2>
          <p>Hello,</p>
          <p>${statusMessages[newStatus]} for the position: <strong>${job.title}</strong> at <strong>${school.schoolName}</strong></p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">Application Details</h3>
            <p><strong>Position:</strong> ${job.title}</p>
            <p><strong>School:</strong> ${school.schoolName}</p>
            <p><strong>Status:</strong> ${newStatus.replace('-', ' ').toUpperCase()}</p>
            <p><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <p>Please log in to your dashboard for more details and next steps.</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL}/teacher/applications" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              View Application
            </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from Teachers Link. Please do not reply to this email.
          </p>
        </div>
      `;

      await this.sendEmail(applicant.email, subject, html);
      
      return { success: true, message: 'Status update notification sent' };
    } catch (error) {
      console.error('Failed to send status update notification:', error);
      throw error;
    }
  }

  // Send job posting reminder
  async notifyJobPostingReminder(jobId) {
    try {
      const job = await Job.findById(jobId)
        .populate('school', 'schoolName contactInfo')
        .populate('postedBy', 'email');

      if (!job) {
        throw new Error('Job not found');
      }

      const school = job.school;
      const user = job.postedBy;

      const subject = `Job Posting Reminder: ${job.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Job Posting Reminder</h2>
          <p>Hello,</p>
          <p>This is a reminder about your job posting: <strong>${job.title}</strong></p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">Job Details</h3>
            <p><strong>Title:</strong> ${job.title}</p>
            <p><strong>Department:</strong> ${job.department}</p>
            <p><strong>Status:</strong> ${job.status}</p>
            <p><strong>Views:</strong> ${job.views}</p>
            <p><strong>Applications:</strong> ${job.applications}</p>
            <p><strong>Expires:</strong> ${new Date(job.expiresAt).toLocaleDateString()}</p>
          </div>
          
          <p>Consider promoting your job posting or extending the deadline if needed.</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL}/school/jobs/${jobId}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Manage Job Posting
            </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from Teachers Link. Please do not reply to this email.
          </p>
        </div>
      `;

      await this.sendEmail(user.email, subject, html);
      
      return { success: true, message: 'Job posting reminder sent' };
    } catch (error) {
      console.error('Failed to send job posting reminder:', error);
      throw error;
    }
  }

  // Send new job alert to teachers
  async notifyNewJobAlert(jobId, teacherEmails = []) {
    try {
      const job = await Job.findById(jobId)
        .populate('school', 'schoolName address contactInfo');

      if (!job) {
        throw new Error('Job not found');
      }

      const school = job.school;

      // If no emails provided, get all teacher emails
      if (teacherEmails.length === 0) {
        const teachers = await User.find({ role: 'teacher' });
        teacherEmails = teachers.map(teacher => teacher.email);
      }

      const subject = `New Job Opportunity: ${job.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Job Opportunity</h2>
          <p>Hello,</p>
          <p>A new teaching position has been posted that might interest you!</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">Job Details</h3>
            <p><strong>Title:</strong> ${job.title}</p>
            <p><strong>School:</strong> ${school.schoolName}</p>
            <p><strong>Department:</strong> ${job.department}</p>
            <p><strong>Type:</strong> ${job.employmentType}</p>
            <p><strong>Location:</strong> ${job.location.city}, ${job.location.state}</p>
            <p><strong>Deadline:</strong> ${new Date(job.applicationDeadline).toLocaleDateString()}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <p><strong>Description:</strong></p>
            <p>${job.description.substring(0, 200)}...</p>
          </div>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL}/jobs/${jobId}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              View Job Details
            </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from Teachers Link. You can unsubscribe from job alerts in your profile settings.
          </p>
        </div>
      `;

      // Send to multiple teachers
      const emailPromises = teacherEmails.map(email => 
        this.sendEmail(email, subject, html)
      );

      await Promise.all(emailPromises);
      
      return { success: true, message: `Job alert sent to ${teacherEmails.length} teachers` };
    } catch (error) {
      console.error('Failed to send job alert:', error);
      throw error;
    }
  }

  // Send interview reminder
  async notifyInterviewReminder(applicationId) {
    try {
      const application = await JobApplication.findById(applicationId)
        .populate('job', 'title')
        .populate('school', 'schoolName contactInfo')
        .populate('applicant', 'email');

      if (!application || !application.interview.scheduledDate) {
        throw new Error('Application or interview not found');
      }

      const school = application.school;
      const job = application.job;
      const applicant = application.applicant;

      const subject = `Interview Reminder: ${job.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Interview Reminder</h2>
          <p>Hello,</p>
          <p>This is a reminder about your upcoming interview for the position: <strong>${job.title}</strong></p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">Interview Details</h3>
            <p><strong>Position:</strong> ${job.title}</p>
            <p><strong>School:</strong> ${school.schoolName}</p>
            <p><strong>Date:</strong> ${new Date(application.interview.scheduledDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(application.interview.scheduledDate).toLocaleTimeString()}</p>
            <p><strong>Type:</strong> ${application.interview.interviewType}</p>
            ${application.interview.location ? `<p><strong>Location:</strong> ${application.interview.location}</p>` : ''}
          </div>
          
          <p>Please prepare for the interview and arrive on time. Good luck!</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL}/teacher/applications/${applicationId}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              View Application
            </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from Teachers Link. Please do not reply to this email.
          </p>
        </div>
      `;

      await this.sendEmail(applicant.email, subject, html);
      
      return { success: true, message: 'Interview reminder sent' };
    } catch (error) {
      console.error('Failed to send interview reminder:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;




