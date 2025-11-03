  const multer = require('multer');
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  const path = require('path');

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  // File filter function
  const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'text/plain': '.txt',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif'
    };

    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: PDF, DOC, DOCX, TXT, JPG, PNG, GIF`), false);
    }
  };

  // Configure storage for different file types
  const createStorage = (folder) => {
    return new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: `teacherslink/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt'],
        transformation: [
          { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
        ],
        resource_type: 'auto',
        access_mode: 'public'
      }
    });
  };

  // Resume upload configuration
  const resumeStorage = createStorage('resumes');
  const resumeUpload = multer({
    storage: resumeStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 1 // Only one file at a time
    }
  });

  // Portfolio upload configuration
  const portfolioStorage = createStorage('portfolios');
  const portfolioUpload = multer({
    storage: portfolioStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 5 // Up to 5 files
    }
  });

  // Document upload configuration
  const documentStorage = createStorage('documents');
  const documentUpload = multer({
    storage: documentStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 10 // Up to 10 files
    }
  });

  // Profile image upload configuration
  const profileStorage = createStorage('profiles');
  const profileUpload = multer({
    storage: profileStorage,
    fileFilter: (req, file, cb) => {
      // Only allow images for profile pictures
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for profile pictures'), false);
      }
    },
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB limit
      files: 1 // Only one file
    }
  });

  // School logo upload configuration
  const logoStorage = createStorage('logos');
  const logoUpload = multer({
    storage: logoStorage,
    fileFilter: (req, file, cb) => {
      // Only allow images for logos
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for logos'), false);
      }
    },
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB limit
      files: 1 // Only one file
    }
  });

  // Middleware functions
  const uploadResume = resumeUpload.single('resume');
  const uploadPortfolio = portfolioUpload.array('portfolio', 5);
  const uploadDocuments = documentUpload.array('documents', 10);
  const uploadProfile = profileUpload.single('profileImage');
  const uploadLogo = logoUpload.single('logo');

  // Combined middleware for application submission (resume + portfolio + documents)
  const combinedStorage = createStorage('applications'); // single Cloudinary folder

const upload = multer({
  storage: combinedStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 15
  }
});

const uploadApplicationFiles = (req, res, next) => {
  console.log('uploadApplicationFiles - Starting file upload middleware');
  
  const multerUpload = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'portfolio', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
  ]);
  
  multerUpload(req, res, (err) => {
    if (err) {
      console.error('uploadApplicationFiles - Error:', err);
      return next(err);
    }
    
    console.log('uploadApplicationFiles - Files uploaded successfully');
    console.log('uploadApplicationFiles - req.file:', req.file);
    console.log('uploadApplicationFiles - req.files:', req.files);
    next();
  });
};


  // Error handling middleware
  const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Please check the file size limits.'
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Please check the file count limits.'
        });
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.'
        });
      }
    }
    
    if (error.message.includes('File type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  };

  // Utility function to delete file from Cloudinary
  const deleteFile = async (publicId) => {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      throw error;
    }
  };

  // Utility function to get file info
  const getFileInfo = (file) => {
    if (!file) return null;
    
    return {
      filename: file.originalname,
      url: file.path,
      publicId: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date()
    };
  };

  // Utility function to validate file size
  const validateFileSize = (file, maxSize) => {
    if (file.size > maxSize) {
      throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }
    return true;
  };

  // Utility function to validate file type
  const validateFileType = (file, allowedTypes) => {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }
    return true;
  };

  module.exports = {
    uploadResume,
    uploadPortfolio,
    uploadDocuments,
    uploadProfile,
    uploadLogo,
    uploadApplicationFiles,
    handleUploadError,
    deleteFile,
    getFileInfo,
    validateFileSize,
    validateFileType,
    cloudinary
  };




