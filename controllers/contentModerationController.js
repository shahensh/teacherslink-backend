const asyncHandler = require('express-async-handler');

// Content moderation for posts
const moderatePost = asyncHandler(async (req, res) => {
  const { caption, mediaUrls = [] } = req.body;

  // Allow posts with no content (image-only or text-only posts)
  if (!caption && mediaUrls.length === 0) {
    return res.json({
      success: true,
      moderation: {
        isAppropriate: true,
        violations: [],
        severity: 0
      },
      message: 'No content to moderate - post approved'
    });
  }

  const violations = [];
  const moderationResult = {
    isAppropriate: true,
    violations: [],
    severity: 0
  };

  // Text content moderation (only if caption exists and is not empty)
  if (caption && caption.trim() && caption.trim().length > 0) {
    const textViolations = await moderateTextContent(caption);
    violations.push(...textViolations);
  }

  // Image content moderation
  for (const mediaUrl of mediaUrls) {
    if (mediaUrl && mediaUrl.trim()) {
      const imageViolations = await moderateImageContent(mediaUrl);
      violations.push(...imageViolations);
    }
  }

  // Determine overall result
  moderationResult.violations = violations;
  moderationResult.isAppropriate = violations.length === 0;
  moderationResult.severity = violations.length > 0 ? 
    Math.max(...violations.map(v => v.severity === 'high' ? 3 : v.severity === 'medium' ? 2 : 1)) : 0;

  res.json({
    success: true,
    moderation: moderationResult,
    message: moderationResult.isAppropriate ? 
      'Content approved' : 
      'Content contains inappropriate material'
  });
});

// Text content moderation
const moderateTextContent = async (text) => {
  const violations = [];
  
  // Inappropriate words list
  const inappropriateWords = [
    'fuck', 'shit', 'bitch', 'asshole', 'damn', 'hell', 'crap', 'piss',
    'dick', 'pussy', 'cock', 'tits', 'boobs', 'ass', 'bastard', 'whore',
    'slut', 'fag', 'nigger', 'retard', 'stupid', 'idiot', 'moron',
    'sex', 'porn', 'pornography', 'nude', 'naked', 'nudity', 'masturbat',
    'orgasm', 'penis', 'vagina', 'breast', 'nipple', 'genital',
    'kill', 'murder', 'suicide', 'bomb', 'terrorist', 'hate', 'racist',
    'violence', 'weapon', 'gun', 'knife', 'blood', 'death',
    'drug', 'cocaine', 'heroin', 'marijuana', 'weed', 'alcohol', 'drunk',
    'high', 'stoned', 'addiction', 'overdose',
    'spam', 'scam', 'fraud', 'fake', 'phishing', 'hack'
  ];

  const lowerText = text.toLowerCase();
  
  // Check for inappropriate words
  for (const word of inappropriateWords) {
    if (lowerText.includes(word.toLowerCase())) {
      violations.push({
        type: 'inappropriate_word',
        word: word,
        severity: 'high',
        message: `Inappropriate language detected: "${word}"`
      });
    }
  }

  // Check for excessive repetition
  const words = text.split(/\s+/);
  const wordCount = {};
  words.forEach(word => {
    wordCount[word.toLowerCase()] = (wordCount[word.toLowerCase()] || 0) + 1;
  });

  for (const [word, count] of Object.entries(wordCount)) {
    if (count > 5 && word.length > 2) {
      violations.push({
        type: 'excessive_repetition',
        word: word,
        count: count,
        severity: 'medium',
        message: `Excessive repetition of word: "${word}" (${count} times)`
      });
    }
  }

  // Check for spam patterns
  const spamPatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
    /https?:\/\/[^\s]+/g, // URLs
    /(.)\1{4,}/g, // Repeated characters
    /\b[A-Z]{5,}\b/g // All caps
  ];

  for (const pattern of spamPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      violations.push({
        type: 'spam_pattern',
        pattern: pattern.toString(),
        matches: matches,
        severity: 'medium',
        message: 'Suspicious content pattern detected'
      });
    }
  }

  return violations;
};

// Image content moderation (basic implementation)
const moderateImageContent = async (imageUrl) => {
  const violations = [];
  
  // Basic URL validation
  if (!imageUrl || typeof imageUrl !== 'string') {
    return violations;
  }

  // Check for suspicious file extensions
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
  const lowerUrl = imageUrl.toLowerCase();
  
  for (const ext of suspiciousExtensions) {
    if (lowerUrl.includes(ext)) {
      violations.push({
        type: 'suspicious_file',
        extension: ext,
        severity: 'high',
        message: 'Suspicious file type detected'
      });
    }
  }

  // Check for very long URLs (potential spam)
  if (imageUrl.length > 500) {
    violations.push({
      type: 'suspicious_url',
      length: imageUrl.length,
      severity: 'medium',
      message: 'Suspicious URL length'
    });
  }

  // Note: For production, you would integrate with AI services like:
  // - Google Cloud Vision API
  // - AWS Rekognition
  // - Azure Computer Vision
  // - Custom ML models for content detection

  return violations;
};

// Get moderation statistics (admin only)
const getModerationStats = asyncHandler(async (req, res) => {
  // This would typically query a moderation_logs collection
  // For now, return basic stats
  res.json({
    success: true,
    stats: {
      totalModerated: 0,
      approved: 0,
      rejected: 0,
      pending: 0
    }
  });
});

module.exports = {
  moderatePost,
  getModerationStats
};
