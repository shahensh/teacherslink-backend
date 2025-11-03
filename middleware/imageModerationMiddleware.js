const { moderateImage, getModerationErrorMessage } = require('../services/imageModeration');
const cloudinary = require('cloudinary').v2;

/**
 * Middleware to moderate images after Cloudinary upload
 * This should be used AFTER the image is uploaded to Cloudinary
 * If moderation fails, it will delete the image from Cloudinary
 */
const moderateUploadedImage = async (req, res, next) => {
  try {
    // Check if there's an uploaded image URL
    const imageUrl = req.uploadedImageUrl || req.body.imageUrl;

    if (!imageUrl) {
      return next(); // No image to moderate, continue
    }

    console.log('🔍 Moderating uploaded image:', imageUrl);

    // Moderate the image
    const moderationResult = await moderateImage(imageUrl);

    // If moderation was skipped (AWS not configured), continue
    if (moderationResult.skipped) {
      console.warn('⚠️ Image moderation skipped - AWS not configured');
      req.moderationResult = moderationResult;
      return next();
    }

    // Store moderation result in request for logging
    req.moderationResult = moderationResult;

    // If image is inappropriate, delete it from Cloudinary and return error
    if (moderationResult.isInappropriate) {
      console.log('❌ Inappropriate content detected:', moderationResult.detectedLabels);

      // Extract public_id from Cloudinary URL to delete it
      try {
        const publicId = extractPublicIdFromUrl(imageUrl);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          console.log('🗑️ Deleted inappropriate image from Cloudinary:', publicId);
        }
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
        // Continue even if deletion fails
      }

      // Return error to user
      const errorMessage = getModerationErrorMessage(moderationResult);
      return res.status(400).json({
        success: false,
        message: errorMessage,
        moderationDetails: {
          detectedContent: moderationResult.detectedLabels.map(l => l.name),
          categories: Object.keys(moderationResult.categories).filter(
            key => moderationResult.categories[key]
          )
        }
      });
    }

    console.log('✅ Image passed moderation');
    next();

  } catch (error) {
    console.error('Error in image moderation middleware:', error);
    
    // Don't block the request if moderation fails due to technical issues
    // Log the error and continue
    console.warn('⚠️ Image moderation failed, allowing upload:', error.message);
    req.moderationError = error.message;
    next();
  }
};

/**
 * Extract Cloudinary public_id from URL
 * Example: https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg
 * Returns: sample
 */
const extractPublicIdFromUrl = (url) => {
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload' and version (v1234)
    const pathParts = parts.slice(uploadIndex + 2); // Skip 'upload' and version
    const filename = pathParts.join('/');
    
    // Remove file extension
    return filename.replace(/\.[^/.]+$/, '');
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

/**
 * Moderate image from URL (for existing images or external URLs)
 */
const moderateImageUrl = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    console.log('🔍 Moderating image from URL:', imageUrl);

    const moderationResult = await moderateImage(imageUrl);

    if (moderationResult.skipped) {
      return res.json({
        success: true,
        message: 'Moderation skipped - AWS not configured',
        isInappropriate: false
      });
    }

    if (moderationResult.isInappropriate) {
      const errorMessage = getModerationErrorMessage(moderationResult);
      return res.status(400).json({
        success: false,
        message: errorMessage,
        isInappropriate: true,
        moderationDetails: {
          detectedContent: moderationResult.detectedLabels.map(l => l.name),
          categories: Object.keys(moderationResult.categories).filter(
            key => moderationResult.categories[key]
          )
        }
      });
    }

    res.json({
      success: true,
      message: 'Image passed moderation',
      isInappropriate: false,
      moderationResult
    });

  } catch (error) {
    console.error('Error moderating image:', error);
    res.status(500).json({
      success: false,
      message: 'Error moderating image',
      error: error.message
    });
  }
};

module.exports = {
  moderateUploadedImage,
  moderateImageUrl,
  extractPublicIdFromUrl
};


