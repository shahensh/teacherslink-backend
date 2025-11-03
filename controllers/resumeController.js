asyncHandler = require('express-async-handler');
const Resume = require('../models/Resume');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// @desc    Create or update teacher resume
// @route   POST /api/resumes
// @access  Private (Teacher)
const createOrUpdateResume = asyncHandler(async (req, res) => {
  try {
    console.log('createOrUpdateResume - User ID:', req.user.id);
    console.log('createOrUpdateResume - Request body:', JSON.stringify(req.body, null, 2));
    console.log('createOrUpdateResume - Request headers:', req.headers);
   
    const teacherId = req.user.id;
   
    // Find teacher profile
    const teacher = await Teacher.findOne({ user: teacherId });
    if (!teacher) {
      console.log('createOrUpdateResume - Teacher profile not found for user:', teacherId);
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }
   
    console.log('createOrUpdateResume - Found teacher:', teacher._id);

    // Check if resume already exists
    let resume = await Resume.findOne({ teacher: teacher._id });
    console.log('createOrUpdateResume - Existing resume found:', !!resume);
   
    if (resume) {
      console.log('createOrUpdateResume - Updating existing resume');
      // Update existing resume
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          resume[key] = req.body[key];
        }
      });
      
      // Sync profile image from teacher profile to resume
      if (teacher.personalInfo?.profileImage) {
        if (!resume.personalInfo) {
          resume.personalInfo = {};
        }
        resume.personalInfo.profileImage = teacher.personalInfo.profileImage;
        console.log('createOrUpdateResume - Synced profile image to resume:', teacher.personalInfo.profileImage);
      }
      
      resume.lastUpdated = new Date();
      await resume.save();
      console.log('createOrUpdateResume - Resume updated successfully');
    } else {
      console.log('createOrUpdateResume - Creating new resume');
      // Create new resume
      const resumeData = {
        teacher: teacher._id,
        ...req.body
      };
      
      // Sync profile image from teacher profile to resume
      if (teacher.personalInfo?.profileImage) {
        if (!resumeData.personalInfo) {
          resumeData.personalInfo = {};
        }
        resumeData.personalInfo.profileImage = teacher.personalInfo.profileImage;
        console.log('createOrUpdateResume - Synced profile image to new resume:', teacher.personalInfo.profileImage);
      }
      
      resume = new Resume(resumeData);
      await resume.save();
      console.log('createOrUpdateResume - Resume created successfully');
    }

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: resume
    });
  } catch (error) {
    console.error('Error creating/updating resume:', error);
    res.status(500).json({ success: false, message: 'Failed to update resume' });
  }
});

// @desc    Get teacher resume
// @route   GET /api/resumes/me
// @access  Private (Teacher)
const getMyResume = asyncHandler(async (req, res) => {
  try {
    const teacherId = req.user.id;
   
    // Find teacher profile
    const teacher = await Teacher.findOne({ user: teacherId });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Find resume
    const resume = await Resume.findOne({ teacher: teacher._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    res.json({ success: true, data: resume });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch resume' });
  }
});

// @desc    Get teacher resume by teacher ID (for schools)
// @route   GET /api/resumes/teacher/:teacherId
// @access  Private (School, Admin)
const getTeacherResume = asyncHandler(async (req, res) => {
  try {
    const { teacherId } = req.params;
   
    console.log('getTeacherResume - Looking for teacher with ID:', teacherId);
   
    // First try to find teacher profile by ID
    let teacher = await Teacher.findById(teacherId);
   
    // If not found, try to find by user ID (in case we're passed a user ID instead of teacher profile ID)
    if (!teacher) {
      console.log('getTeacherResume - Teacher not found by ID, trying by user ID:', teacherId);
      teacher = await Teacher.findOne({ user: teacherId });
    }
   
    if (!teacher) {
      console.log('getTeacherResume - Teacher not found with ID:', teacherId);
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    console.log('getTeacherResume - Found teacher:', teacher._id, teacher.personalInfo?.firstName);

    // Find resume
    const resume = await Resume.findOne({ teacher: teacher._id });
    if (!resume) {
      console.log('getTeacherResume - Resume not found for teacher:', teacher._id);
      return res.status(404).json({ success: false, message: 'Resume not found for this teacher' });
    }

    console.log('getTeacherResume - Found resume:', resume._id);
    res.json({ success: true, data: resume });
  } catch (error) {
    console.error('Error fetching teacher resume:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch resume' });
  }
});

// @desc    Generate PDF resume
// @route   GET /api/resumes/:resumeId/pdf
// @access  Private (Teacher, School, Admin)
const generateResumePDF = asyncHandler(async (req, res) => {
  try {
    const { resumeId } = req.params;
   
    // Find resume
    const resume = await Resume.findById(resumeId).populate('teacher');
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
   
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${resume.personalInfo.name}_Resume.pdf"`);
   
    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    await generatePDFContent(doc, resume);

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

// @desc    Generate PDF resume by teacher ID or for current teacher
// @route   GET /api/resumes/teacher/:teacherId/pdf OR /api/resumes/me/pdf
// @access  Private (School, Admin) OR Private (Teacher)
const generateTeacherResumePDF = asyncHandler(async (req, res) => {
  try {
    let teacherId = req.params.teacherId;
    let teacher;
   
    console.log('generateTeacherResumePDF - User making request:', req.user?.role, req.user?.email);
    console.log('generateTeacherResumePDF - TeacherId from params:', teacherId);
   
    // If no teacherId in params, this is a teacher viewing their own resume
    if (!teacherId) {
      console.log('generateTeacherResumePDF - No teacherId provided, finding teacher for current user:', req.user.id);
      teacher = await Teacher.findOne({ user: req.user.id });
      if (!teacher) {
        console.log('generateTeacherResumePDF - Teacher profile not found for current user');
        return res.status(404).json({ success: false, message: 'Teacher profile not found' });
      }
    } else {
      // First try to find teacher profile by ID
      teacher = await Teacher.findById(teacherId);
     
      // If not found, try to find by user ID (in case we're passed a user ID instead of teacher profile ID)
      if (!teacher) {
        console.log('generateTeacherResumePDF - Teacher not found by ID, trying by user ID:', teacherId);
        teacher = await Teacher.findOne({ user: teacherId });
      }
    }
   
    if (!teacher) {
      console.log('generateTeacherResumePDF - Teacher not found with ID:', teacherId);
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    console.log('generateTeacherResumePDF - Found teacher:', teacher._id, teacher.personalInfo?.firstName);

    const resume = await Resume.findOne({ teacher: teacher._id });
    if (!resume) {
      console.log('generateTeacherResumePDF - Resume not found for teacher:', teacher._id);
      return res.status(404).json({ success: false, message: 'Resume not found for this teacher' });
    }

    console.log('generateTeacherResumePDF - Found resume:', resume._id, 'Generating PDF...');
    
    // Ensure profile image is synced from teacher profile to resume data
    if (teacher.personalInfo?.profileImage && (!resume.personalInfo?.profileImage || resume.personalInfo.profileImage !== teacher.personalInfo.profileImage)) {
      if (!resume.personalInfo) {
        resume.personalInfo = {};
      }
      resume.personalInfo.profileImage = teacher.personalInfo.profileImage;
      console.log('generateTeacherResumePDF - Synced latest profile image:', teacher.personalInfo.profileImage);
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
   
    // Set response headers
    const fullName = `${resume.personalInfo.firstName || ''} ${resume.personalInfo.lastName || ''}`.trim() || 'Teacher';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fullName}_Resume.pdf"`);
   
    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    await generatePDFContent(doc, resume);

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating teacher PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

// Helper function to generate PDF content
const generatePDFContent = async (doc, resume) => {
  console.log('generatePDFContent - Resume data received:', JSON.stringify(resume, null, 2));
 
  const pageWidth = doc.page.width;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
 
  // Professional ATS-friendly color scheme (minimal colors)
  const primaryColor = '#000000'; // Black for ATS compatibility
  const secondaryColor = '#333333'; // Dark gray
  const accentColor = '#f8f9fa'; // Very light gray
  const highlightColor = '#000000'; // Black for emphasis
 
  // Helper function to add section header (ATS-friendly)
  const addSectionHeader = (title, y) => {
    const startY = Math.max(y || margin, margin) + 15;
    
    // Simple, clean section title
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text(title.toUpperCase(), margin, startY);
    
    // Simple underline
    doc.moveTo(margin, startY + 12)
       .lineTo(margin + 60, startY + 12)
       .stroke(primaryColor, 1);
    
    return startY + 20;
  };
 
  // Helper function to add contact info (compact, ATS-friendly)
  const addContactInfo = (y) => {
    const startY = Math.max(y || margin, margin);
    const contactItems = [];
    
    // Check both personalInfo and socialLinks for contact details
    const personalInfo = resume.personalInfo || {};
    const socialLinks = resume.socialLinks || {};
    
    if (personalInfo.email) contactItems.push(personalInfo.email);
    if (personalInfo.phone) contactItems.push(personalInfo.phone);
    if (personalInfo.address?.city) {
      const location = `${personalInfo.address.city}, ${personalInfo.address.state || ''}`.trim();
      contactItems.push(location);
    }
    if (socialLinks.linkedin || personalInfo.linkedin) {
      contactItems.push(socialLinks.linkedin || personalInfo.linkedin);
    }
    if (socialLinks.portfolio || personalInfo.portfolio) {
      contactItems.push(socialLinks.portfolio || personalInfo.portfolio);
    }
    
    // Display contact info in a single line (ATS-friendly)
    if (contactItems.length > 0) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(contactItems.join(' • '), margin, startY);
    }
    
    return startY + 15;
  };

  // Helper function to add contact info with custom width (to avoid photo overlap)
  const addContactInfoWithWidth = (y, maxWidth) => {
    const startY = Math.max(y || margin, margin);
    const contactItems = [];
    
    // Check both personalInfo and socialLinks for contact details
    const personalInfo = resume.personalInfo || {};
    const socialLinks = resume.socialLinks || {};
    
    if (personalInfo.email) contactItems.push(personalInfo.email);
    if (personalInfo.phone) contactItems.push(personalInfo.phone);
    if (personalInfo.address?.city) {
      const location = `${personalInfo.address.city}, ${personalInfo.address.state || ''}`.trim();
      contactItems.push(location);
    }
    if (socialLinks.linkedin || personalInfo.linkedin) {
      contactItems.push(socialLinks.linkedin || personalInfo.linkedin);
    }
    if (socialLinks.portfolio || personalInfo.portfolio) {
      contactItems.push(socialLinks.portfolio || personalInfo.portfolio);
    }
    
    // Display contact info with width constraint and line wrapping (ATS-friendly)
    if (contactItems.length > 0) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(contactItems.join(' • '), margin, startY, { 
           width: maxWidth,
           lineGap: 2 // Small gap between lines if text wraps
         });
    }
    
    return startY + 15;
  };
 
  // Helper function to format date
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  };
 
  // Helper function to wrap text (simplified for ATS)
  const wrapText = (text, width, x, y) => {
    const validY = Math.max(y || margin, margin);
    const validX = Math.max(x || margin, margin);
    const validWidth = Math.max(width || contentWidth, 100);
    
    // Simple text wrapping
    doc.fontSize(10).font('Helvetica');
    const lines = doc.text(text, validX, validY, { width: validWidth });
    
    return validY + (lines.length * 12);
  };
 
  // HEADER SECTION (With Professional Photo)
  let currentY = margin;
 
  // Profile image (if available) - positioned to avoid overlap
  const profileImageUrl = resume.personalInfo?.profileImage || resume.files?.profileImage;
  const imageSize = 50; // Reduced size to avoid overlap
  const imageX = pageWidth - margin - imageSize;
  const imageY = currentY + 5; // Moved down slightly to avoid overlap
  
  console.log('generatePDFContent - Profile image URL:', profileImageUrl);
  console.log('generatePDFContent - Resume personalInfo:', resume.personalInfo);
 
  if (profileImageUrl) {
    try {
      console.log('Attempting to load profile image from:', profileImageUrl);
     
      // Download image from URL
      const imageResponse = await axios.get(profileImageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
     
      if (imageResponse.data && imageResponse.data.length > 0) {
        console.log('Image loaded successfully, size:', imageResponse.data.length);
       
        // Create circular clipping path for professional look
        doc.save();
        doc.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2);
        doc.clip();
       
        // Add the image with proper scaling to fill the circle completely
        // Use a larger image size and center it within the clipping circle
        const imagePadding = 8; // Extra padding to ensure full coverage
        doc.image(Buffer.from(imageResponse.data), 
          imageX - imagePadding, 
          imageY - imagePadding, 
          {
            width: imageSize + (imagePadding * 2),
            height: imageSize + (imagePadding * 2),
            fit: [imageSize + (imagePadding * 2), imageSize + (imagePadding * 2)],
            align: 'center',
            valign: 'center'
          }
        );
       
        doc.restore();
       
        // Add a subtle professional border
        doc.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2)
           .stroke(primaryColor, 1);
      } else {
        throw new Error('Empty image data');
      }
    } catch (error) {
      console.log('Could not load profile image:', error.message);
     
      // Fallback: Add a professional placeholder
      doc.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2)
         .fill(accentColor)
         .stroke(primaryColor, 1);
     
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('PHOTO', imageX + 12, imageY + imageSize/2 - 6);
    }
  } else {
    // No image provided - add a professional placeholder
    doc.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2)
       .fill(accentColor)
       .stroke(primaryColor, 1);
   
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('PHOTO', imageX + 12, imageY + imageSize/2 - 6);
  }
 
  // Name and headline (positioned to work with photo)
  const personalInfo = resume.personalInfo || {};
  const professionalInfo = resume.professionalInfo || {};
 
  // Handle both name formats (name field or firstName/lastName)
  let fullName = personalInfo.name || '';
  if (!fullName && (personalInfo.firstName || personalInfo.lastName)) {
    fullName = `${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`.trim();
  }
  if (!fullName) {
    fullName = 'Professional Teacher';
  }
 
  // Name (larger, prominent) - positioned to avoid photo
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor(primaryColor)
     .text(fullName, margin, currentY);
 
  currentY += 25;
 
  // Headline (if available) - positioned to avoid photo
  const headline = personalInfo.headline || professionalInfo.headline;
  if (headline) {
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor(secondaryColor)
       .text(headline, margin, currentY);
    currentY += 20;
  }
 
  // Contact information (single line) - positioned to avoid photo overlap
  // Adjust contact info to avoid overlapping with the profile photo
  const contactInfoWidth = contentWidth - imageSize - 40; // Leave even more space for photo
  currentY = addContactInfoWithWidth(currentY, contactInfoWidth);
  currentY += 10;
 
  // PROFESSIONAL SUMMARY (Detailed)
  const bio = personalInfo.bio || professionalInfo.bio;
  if (bio) {
    currentY = addSectionHeader('PROFESSIONAL SUMMARY', currentY);
    
    // Allow longer bio for more detail
    const maxBioLength = 400;
    const truncatedBio = bio.length > maxBioLength ? bio.substring(0, maxBioLength) + '...' : bio;
    
    // Calculate actual text height
    const bioHeight = doc.heightOfString(truncatedBio, {
      width: contentWidth,
      align: 'left'
    });
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(highlightColor)
       .text(truncatedBio, margin, currentY, {
         width: contentWidth,
         align: 'left'
       });
    
    currentY += bioHeight + 15; // Dynamic spacing based on content
  }
 
  // EDUCATION (Detailed)
  const education = resume.education || resume.professionalInfo?.qualification || [];
  if (education && education.length > 0) {
    currentY = addSectionHeader('EDUCATION', currentY);
    
    // Show more education entries (up to 4)
    const limitedEducation = education.slice(0, 4);
    
    limitedEducation.forEach(edu => {
      if (!edu) return;
      
      // Degree and Institution
      const degree = edu.degree || 'Degree';
      const institution = edu.institution || edu.university || 'Institution';
      const year = edu.year || edu.yearOfPassing || '';
      const grade = edu.grade || '';
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(highlightColor)
         .text(`${degree}`, margin, currentY);
      
      currentY += 14; // Space after degree
      
      // Institution and details
      let institutionLine = institution;
      if (year) institutionLine += `, ${year}`;
      if (grade) institutionLine += ` | Grade: ${grade}`;
      
      // Calculate height for institution line
      const instHeight = doc.heightOfString(institutionLine, { width: contentWidth });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(institutionLine, margin, currentY);
      
      currentY += instHeight + 12; // Dynamic spacing
    });
    
    currentY += 10;
  }
 
  // EXPERIENCE (Detailed)
  const experience = resume.experience || resume.professionalInfo?.experience || [];
  if (experience && experience.length > 0) {
    currentY = addSectionHeader('PROFESSIONAL EXPERIENCE', currentY);
    
    // Show more experiences (up to 5)
    const limitedExperience = experience.slice(0, 5);
    
    limitedExperience.forEach(exp => {
      if (!exp) return;
      
      // Job title
      const position = exp.position || exp.role || 'Position';
      const company = exp.school || exp.schoolName || 'Institution';
      const startDate = formatDate(exp.startDate || exp.from);
      const endDate = exp.current ? 'Present' : formatDate(exp.endDate || exp.to);
      const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : '';
      
      // Position (bold)
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(highlightColor)
         .text(`${position}`, margin, currentY);
      
      currentY += 14; // Space after position
      
      // Company and dates
      let companyLine = company;
      if (dateRange) companyLine += ` | ${dateRange}`;
      
      // Calculate height for company line
      const companyHeight = doc.heightOfString(companyLine, { width: contentWidth });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(companyLine, margin, currentY);
      
      currentY += companyHeight + 10;
      
      // Detailed description (longer)
      if (exp.description) {
        const maxDescLength = 300;
        const truncatedDesc = exp.description.length > maxDescLength ? 
          exp.description.substring(0, maxDescLength) + '...' : exp.description;
        
        // Calculate description height
        const descHeight = doc.heightOfString(truncatedDesc, { width: contentWidth });
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(highlightColor)
           .text(truncatedDesc, margin, currentY, { width: contentWidth });
        
        currentY += descHeight + 10; // Dynamic spacing
      }
      
      currentY += 15; // Spacing between experiences
    });
    
    currentY += 10;
  }
 
  // SKILLS (Detailed)
  const skills = resume.skills || resume.professionalInfo?.skills || [];
  if (skills && skills.length > 0) {
    currentY = addSectionHeader('SKILLS & EXPERTISE', currentY);
    
    // Show more skills (up to 15)
    const limitedSkills = skills.slice(0, 15);
    const skillsText = limitedSkills.join(' • ');
    
    // Calculate skills height
    const skillsHeight = doc.heightOfString(skillsText, { width: contentWidth });
    
    // Display skills in a simple comma-separated format (ATS-friendly)
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(highlightColor)
       .text(skillsText, margin, currentY, { width: contentWidth });
    
    currentY += skillsHeight + 15; // Dynamic spacing
  }
 
  // ADDITIONAL INFORMATION (Detailed)
  const specialization = resume.specialization || resume.professionalInfo?.subjects || resume.professionalInfo?.specialization || [];
  const certifications = resume.certifications || resume.professionalInfo?.certifications || [];
  const achievements = resume.achievements || resume.professionalInfo?.achievements || [];
  const languages = resume.languages || resume.professionalInfo?.languages || [];
  
  // Only show this section if there's additional information
  if (specialization.length > 0 || certifications.length > 0 || achievements.length > 0 || languages.length > 0) {
    currentY = addSectionHeader('ADDITIONAL INFORMATION', currentY);
    
    // Specialization (show more)
    if (specialization.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(highlightColor)
         .text('Specialization:', margin, currentY);
      
      const specText = specialization.slice(0, 8).join(' • ');
      const specHeight = doc.heightOfString(specText, { width: contentWidth - 90 });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(specText, margin + 90, currentY, { width: contentWidth - 90 });
      
      currentY += Math.max(specHeight, 12) + 8; // Dynamic height
    }
    
    // Certifications (show more with details)
    if (certifications.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(highlightColor)
         .text('Certifications:', margin, currentY);
      
      const certDetails = certifications.slice(0, 5).map(cert => {
        const name = cert.name || cert.title || 'Certification';
        const issuer = cert.issuer || '';
        const year = cert.year || '';
        return issuer ? `${name} (${issuer}${year ? `, ${year}` : ''})` : name;
      });
      
      const certText = certDetails.join(' • ');
      const certHeight = doc.heightOfString(certText, { width: contentWidth - 90 });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(certText, margin + 90, currentY, { width: contentWidth - 90 });
      
      currentY += Math.max(certHeight, 12) + 8; // Dynamic height
    }
    
    // Languages
    if (languages.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(highlightColor)
         .text('Languages:', margin, currentY);
      
      const langText = languages.join(' • ');
      const langHeight = doc.heightOfString(langText, { width: contentWidth - 90 });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(langText, margin + 90, currentY, { width: contentWidth - 90 });
      
      currentY += Math.max(langHeight, 12) + 8; // Dynamic height
    }
    
    // Achievements (show more)
    if (achievements.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(highlightColor)
         .text('Key Achievements:', margin, currentY);
      
      const keyAchievements = achievements.slice(0, 4);
      const achText = keyAchievements.join(' • ');
      const achHeight = doc.heightOfString(achText, { width: contentWidth - 110 });
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(achText, margin + 110, currentY, { width: contentWidth - 110 });
      
      currentY += Math.max(achHeight, 12) + 8; // Dynamic height
    }
    
    currentY += 20;
  }
 
  // Footer (minimal)
  const footerY = doc.page.height - 20;
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(secondaryColor)
     .text('Generated by TeachersLink', margin, footerY, { align: 'center' });
};

// @desc    Delete resume
// @route   DELETE /api/resumes/me
// @access  Private (Teacher)
const deleteResume = asyncHandler(async (req, res) => {
  try {
    const teacherId = req.user.id;
   
    // Find teacher profile
    const teacher = await Teacher.findOne({ user: teacherId });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Delete resume
    await Resume.findOneAndDelete({ teacher: teacher._id });

    res.json({ success: true, message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ success: false, message: 'Failed to delete resume' });
  }
});

module.exports = {
  createOrUpdateResume,
  getMyResume,
  getTeacherResume,
  generateResumePDF,
  generateTeacherResumePDF,
  deleteResume
};
