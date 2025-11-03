const AWS = require('aws-sdk');
const fetch = globalThis.fetch || require('node-fetch');

// Configure AWS Rekognition
const rekognition = new AWS.Rekognition({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Moderate image using AWS Rekognition
 * @param {string} imageUrl - URL of the image to moderate (from Cloudinary)
 * @returns {Promise<Object>} - Moderation results
 */
const moderateImage = async (imageUrl) => {
  try {
    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || 
        process.env.AWS_ACCESS_KEY_ID === 'your_aws_access_key_here' ||
        process.env.AWS_SECRET_ACCESS_KEY === 'your_aws_secret_key_here') {
      console.warn('⚠️ AWS Rekognition not configured. Skipping moderation.');
      return {
        isInappropriate: false,
        categories: {},
        detectedLabels: [],
        error: 'AWS not configured',
        skipped: true
      };
    }

    console.log('Starting image moderation for:', imageUrl);

    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Call AWS Rekognition DetectModerationLabels
    const params = {
      Image: {
        Bytes: imageBuffer
      },
      MinConfidence: 60 // Minimum confidence threshold (0-100)
    };

    const result = await rekognition.detectModerationLabels(params).promise();

    console.log('Moderation result:', JSON.stringify(result, null, 2));

    // Check if any inappropriate content was detected
    const isInappropriate = result.ModerationLabels && result.ModerationLabels.length > 0;

    // Categorize the inappropriate content
    const categories = {
      explicitNudity: false,
      suggestive: false,
      violence: false,
      visuallyDisturbing: false,
      rude: false,
      drugs: false,
      tobacco: false,
      alcohol: false,
      gambling: false,
      hateSymbols: false
    };

    const detectedLabels = [];

    if (result.ModerationLabels) {
      result.ModerationLabels.forEach(label => {
        detectedLabels.push({
          name: label.Name,
          confidence: label.Confidence,
          parentName: label.ParentName
        });

        // Categorize based on parent category
        const parentName = label.ParentName || label.Name;
        
        if (parentName.includes('Explicit Nudity')) {
          categories.explicitNudity = true;
        } else if (parentName.includes('Suggestive')) {
          categories.suggestive = true;
        } else if (parentName.includes('Violence')) {
          categories.violence = true;
        } else if (parentName.includes('Visually Disturbing')) {
          categories.visuallyDisturbing = true;
        } else if (parentName.includes('Rude Gestures')) {
          categories.rude = true;
        } else if (parentName.includes('Drugs')) {
          categories.drugs = true;
        } else if (parentName.includes('Tobacco')) {
          categories.tobacco = true;
        } else if (parentName.includes('Alcohol')) {
          categories.alcohol = true;
        } else if (parentName.includes('Gambling')) {
          categories.gambling = true;
        } else if (parentName.includes('Hate Symbols')) {
          categories.hateSymbols = true;
        }
      });
    }

    return {
      isInappropriate,
      categories,
      detectedLabels,
      moderationModelVersion: result.ModerationModelVersion,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Error moderating image:', error);
    
    // If AWS is not configured or there's an error, log it but don't block uploads
    // You can change this behavior based on your needs
    if (
      error.code === 'CredentialsError' || 
      error.code === 'InvalidSignatureException' ||
      error.code === 'UnrecognizedClientException' ||
      error.message?.includes('security token') ||
      error.message?.includes('The security token included in the request is invalid')
    ) {
      console.warn('⚠️ AWS Rekognition not properly configured. Skipping moderation.');
      return {
        isInappropriate: false,
        categories: {},
        detectedLabels: [],
        error: 'AWS not configured',
        skipped: true
      };
    }

    throw error;
  }
};

/**
 * Get user-friendly error message based on detected content
 * @param {Object} moderationResult - Result from moderateImage
 * @returns {string} - User-friendly error message
 */
const getModerationErrorMessage = (moderationResult) => {
  const { categories, detectedLabels } = moderationResult;

  if (categories.explicitNudity) {
    return 'This image contains explicit content and cannot be uploaded. Please choose a different image.';
  }
  
  if (categories.suggestive) {
    return 'This image contains suggestive content that is not appropriate for an educational platform.';
  }
  
  if (categories.violence) {
    return 'This image contains violent content and cannot be uploaded.';
  }
  
  if (categories.visuallyDisturbing) {
    return 'This image contains disturbing content and cannot be uploaded.';
  }
  
  if (categories.drugs || categories.tobacco || categories.alcohol) {
    return 'This image contains content related to drugs, tobacco, or alcohol which is not appropriate for this platform.';
  }
  
  if (categories.hateSymbols) {
    return 'This image contains hate symbols and cannot be uploaded.';
  }
  
  if (categories.gambling) {
    return 'This image contains gambling-related content and cannot be uploaded.';
  }
  
  if (categories.rude) {
    return 'This image contains inappropriate gestures and cannot be uploaded.';
  }

  // Generic message if we couldn't categorize
  if (detectedLabels.length > 0) {
    return `This image contains inappropriate content (${detectedLabels[0].name}) and cannot be uploaded.`;
  }

  return 'This image contains inappropriate content and cannot be uploaded.';
};

/**
 * Check if AWS Rekognition is configured
 * @returns {boolean} - True if configured
 */
const isConfigured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
};

module.exports = {
  moderateImage,
  getModerationErrorMessage,
  isConfigured
};


