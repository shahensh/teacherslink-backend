const User = require('../models/User');
const Teacher = require('../models/Teacher');
const School = require('../models/School');
const { generateToken } = require('../utils/generateToken');
const { asyncHandler } = require('../middleware/errorMiddleware');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { email, password, role, profileData } = req.body;

  console.log('Registration attempt:', { email, role, profileData: !!profileData });

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    console.log('User already exists:', email);
    return res.status(400).json({
      success: false,
      message: 'User already exists'
    });
  }

  // Create user
  let user;
  try {
    user = await User.create({
      email,
      password,
      role
    });
    console.log('User created successfully:', user._id);
  } catch (userError) {
    console.error('Error creating user:', userError);
    return res.status(400).json({
      success: false,
      message: 'Failed to create user: ' + userError.message
    });
  }

  // Normalize incoming profile fields to support both top-level and nested profileData
  const body = profileData && typeof profileData === 'object' ? profileData : req.body;

  // Create profile based on role
  try {
    if (role === 'teacher') {
      console.log('Creating teacher profile for user:', user._id);
      console.log('Teacher data:', { firstName: body.firstName, lastName: body.lastName, phone: body.phone });
      
      // Validate required fields for teacher
      if (!body.firstName || !body.lastName) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message: 'First name and last name are required for teachers'
        });
      }
      
      await Teacher.create({
        user: user._id,
        personalInfo: {
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone || ''
        }
      });
      console.log('Teacher profile created successfully');
    } else if (role === 'school') {
      console.log('Creating school profile for user:', user._id);
      console.log('School data:', { schoolName: body.schoolName, description: body.description, phone: body.phone });
      
      // Validate required fields for school
      if (!body.schoolName || !body.description) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message: 'School name and description are required for schools'
        });
      }
      
      await School.create({
        user: user._id,
        schoolName: body.schoolName,
        description: body.description,
        address: {
          city: body.city || '',
          state: body.state || '',
          pincode: body.pincode || ''
        },
        contactInfo: {
          phone: body.phone || '',
          email: email
        }
      });
      console.log('School profile created successfully');
    }
  } catch (profileError) {
    console.error('Error creating profile:', profileError);
    // Delete the user if profile creation fails
    await User.findByIdAndDelete(user._id);
    return res.status(400).json({
      success: false,
      message: 'Failed to create profile: ' + profileError.message
    });
  }

  // Generate token
  const token = generateToken({ id: user._id });

  // Emit real-time event for admin dashboard
  if (global.io) {
    global.io.emit('user_registered', {
      _id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    });
    console.log('Emitted user_registered event:', user.email);

    // Emit stats update for home page
    if (role === 'teacher') {
      const totalTeachers = await Teacher.countDocuments();
      global.io.emit('stats_updated', { totalTeachers });
    } else if (role === 'school') {
      const totalSchools = await School.countDocuments();
      global.io.emit('stats_updated', { totalSchools });
    }
  }

  res.status(201).json({
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log('Login attempt for email:', email);

  // Check for user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    console.log('User not found for email:', email);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  console.log('User found:', user.email, 'Role:', user.role, 'IsActive:', user.isActive);

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  console.log('Password match:', isMatch);
  if (!isMatch) {
    console.log('Password does not match for user:', user.email);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken({ id: user._id });

  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    }
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin
    }
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findById(req.user.id);

  if (email) user.email = email;
  if (password) user.password = password;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Set token and expiry
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // Create reset URL pointing to frontend app
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendBase}/reset-password/${resetToken}`;

  // Send email (simplified for demo - in production use proper email service)
  try {
    // Check if email credentials are configured
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
    const emailPort = process.env.EMAIL_PORT || process.env.SMTP_PORT || 587;

    // Validate email configuration
    if (!emailUser || !emailPass || 
        emailUser === 'your_email@gmail.com' || 
        emailPass === 'your_app_password' ||
        emailUser.includes('your-email') ||
        emailPass.includes('your-app-password')) {
      console.error('Email configuration is missing or not set. Please configure EMAIL_USER and EMAIL_PASS in your .env file.');
      console.error('For Gmail, you need to use an App Password. See: https://support.google.com/accounts/answer/185833');
      // Still return success to prevent email enumeration, but log the issue
      return res.json({
        success: true,
        message: 'Password reset email sent'
      });
    }

    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: parseInt(emailPort),
      secure: emailPort === '465', // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass
      },
      // Add connection timeout and retry options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    // Verify transporter configuration
    await transporter.verify();

    const mailOptions = {
      from: `"Teachers Link" <${emailUser}>`,
      to: email,
      subject: 'Password Reset Request - Teachers Link',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Teachers Link account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background: #0A66C2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Reset Password</a>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent successfully to: ${email}`);

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    
    // Provide more specific error information in logs
    if (error.code === 'EAUTH') {
      console.error('Authentication failed. Please check:');
      console.error('1. EMAIL_USER and EMAIL_PASS are correctly set in .env');
      console.error('2. For Gmail, you need to enable 2FA and use an App Password');
      console.error('3. Make sure "Less secure app access" is enabled or use App Password');
      console.error('See: https://support.google.com/accounts/answer/185833');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('Connection to email server failed. Check EMAIL_HOST and EMAIL_PORT.');
    } else {
      console.error('Email error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
    }
    
    // Still return success to prevent email enumeration
    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  }
});

// @desc    Validate reset token
// @route   GET /api/auth/reset-password/:token
// @access  Public
const validateResetToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  }

  res.json({ success: true, message: 'Valid token' });
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Find user by token and check if token is not expired
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  validateResetToken
};

