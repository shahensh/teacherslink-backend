const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const jobRoutes = require('./routes/jobRoutes');
const templateRoutes = require('./routes/templateRoutes');
const schoolPublicRoutes = require('./routes/schoolPublicRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const postRoutes = require('./routes/postRoutes');
const searchRoutes = require('./routes/searchRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const blogRoutes = require('./routes/blogRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const teacherSubscriptionRoutes = require('./routes/teacherSubscriptionRoutes');
const planRoutes = require('./routes/planRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webinarRoutes = require('./routes/webinarRoutes');
const contentModerationRoutes = require('./routes/contentModerationRoutes');
const statsRoutes = require('./routes/stats');
const deviceRoutes = require('./routes/deviceRoutes');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Import socket setup
const setupChatSocket = require('./sockets/chatSocket');
const setupSocialSocket = require('./sockets/socialSocket');
const setupNotificationSocket = require('./sockets/notificationSocket');
const setupRatingSocket = require('./sockets/ratingSocket');
const { setupBlogSocket } = require('./sockets/blogSocket');

// Connect to database
connectDB();

// Initialize push notification service (Firebase Admin SDK)
// This will show initialization status on server startup
try {
  require('./services/pushNotificationService');
  console.log('📲 Push notification service loaded');
} catch (error) {
  console.warn('⚠️  Push notification service could not be loaded:', error.message);
}

const app = express();
const server = createServer(app);

// Allowed frontend origins (website + mobile app)
// Supports ALLOWED_ORIGINS env variable (comma-separated) or defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  // Mobile app origins
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost", // Android emulator
].filter(Boolean);

// Function to check if origin is allowed (for both website and mobile app)
const isOriginAllowed = (origin) => {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) return true;
  
  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Allow Capacitor/Ionic app origins
  if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
    return true;
  }
  
  // Allow localhost variations (for development only - disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost') || 
        origin.startsWith('https://localhost') ||
        origin.startsWith('http://127.0.0.1')) {
      return true;
    }
    
    // Allow local network IPs (for mobile app testing on same network)
    // Matches: http://10.x.x.x, http://192.168.x.x, http://172.16-31.x.x
    const localNetworkPattern = /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
    if (localNetworkPattern.test(origin)) {
      return true;
    }
  }
  
  return false;
};

// Setup Socket.io with mobile app support
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by Socket.IO CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['websocket', 'polling'] // Important for mobile apps
  }
});

// Setup sockets
setupChatSocket(io);
setupSocialSocket(io);
setupNotificationSocket(io);
setupRatingSocket(io);
setupBlogSocket(io);

// Set socket.io instance for blog controller
const { setSocketIO } = require('./controllers/blogController');
setSocketIO(io);

// Make io available globally for all controllers
global.io = io;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration (must be before any route/limiter)
// Supports both website and mobile app (Capacitor) requests
app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
// Respond to preflight requests
app.options('*', cors());

// Rate limiting (more lenient for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Add near top, before JSON body parser if using express.json()
app.use('/api/payments/webhook', express.raw({ type: '*/*' }));

// Body parsing middleware (with increased limits for mobile app file uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => {
  res.send('API is running successfully 🚀');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Teachers Link API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/public', schoolPublicRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/teacher-subscription', teacherSubscriptionRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webinars', webinarRoutes);
app.use('/api/moderation', contentModerationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/devices', deviceRoutes);

// Redirect legacy reset links from backend to frontend
app.get('/reset-password/:token', (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  return res.redirect(`${frontend}/reset-password/${req.params.token}`);
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Teachers Link API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      schools: '/api/schools',
      teachers: '/api/teachers',
      jobs: '/api/jobs',
      templates: '/api/templates',
      analytics: '/api/analytics',
      admin: '/api/admin',
      chat: '/api/chat',
      posts: '/api/posts'
    },
    documentation: 'https://github.com/teacherslink/api-docs'
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for mobile app access

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on ${HOST}:${PORT}`);
  console.log(`📡 Socket.io server running`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  console.log(`📱 Mobile app support: Enabled (Capacitor/Ionic)`);
  console.log(`🌍 Network accessible: http://0.0.0.0:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

module.exports = app;

