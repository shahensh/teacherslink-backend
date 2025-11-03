const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  console.log('Auth middleware - URL:', req.url);
  console.log('Auth middleware - Method:', req.method);
  console.log('Auth middleware - Headers:', req.headers);
  console.log('Auth middleware - Authorization header:', req.headers.authorization);

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Auth middleware - Token exists:', !!token);
      console.log('Auth middleware - Token length:', token ? token.length : 0);
      console.log('Auth middleware - Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
      console.log('Auth middleware - Full authorization header:', req.headers.authorization);

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Auth middleware - Decoded token:', decoded);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      console.log('Auth middleware - User found:', !!req.user);
      console.log('Auth middleware - User role:', req.user?.role);

      if (!req.user) {
        console.log('Auth middleware - User not found');
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user not found'
        });
      }

      if (!req.user.isActive) {
        console.log('Auth middleware - User inactive');
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      console.log('Auth middleware - Authentication successful');
      next();
    } catch (error) {
      console.error('Auth middleware - Token verification error:', error);
      console.error('Auth middleware - Error details:', {
        name: error.name,
        message: error.message,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'No token'
      });
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed',
        error: error.message
      });
    }
  }

  if (!token) {
    console.log('Auth middleware - No token provided');
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten roles in case an array was passed
    const allowedRoles = roles.flat();
    
    console.log('Authorize middleware - User role:', req.user.role);
    console.log('Authorize middleware - Allowed roles:', allowedRoles);
    console.log('Authorize middleware - User authorized:', allowedRoles.includes(req.user.role));
    
    if (!allowedRoles.includes(req.user.role)) {
      console.log('Authorize middleware - Access denied for role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    console.log('Authorize middleware - Access granted');
    next();
  };
};

// Check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account verification required'
    });
  }
  next();
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Ignore token errors for optional auth
      console.log('Optional auth token error:', error.message);
    }
  }

  next();
};
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
};

module.exports = {
  protect,
  authorize,
  requireVerification,
  optionalAuth,
  adminOnly
};








