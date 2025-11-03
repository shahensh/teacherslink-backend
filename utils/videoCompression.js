const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Compress video file to reduce size while maintaining quality
 * @param {Object} file - Multer file object
 * @param {Object} options - Compression options
 * @param {Function} progressCallback - Progress callback function
 * @returns {Promise<Object>} - Compressed file info
 */
const compressVideo = (file, options = {}, progressCallback = null) => {
  return new Promise((resolve, reject) => {
    const {
      quality = 'medium', // low, medium, high
      maxWidth = 1280,
      maxHeight = 720,
      bitrate = '1000k',
      fps = 30
    } = options;

    // Create temporary file paths
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const inputPath = path.join(tempDir, `input_${Date.now()}_${file.originalname}`);
    const outputPath = path.join(tempDir, `compressed_${Date.now()}_${file.originalname}`);

    // Write input file
    fs.writeFileSync(inputPath, file.buffer);

    console.log('Starting video compression...', {
      originalSize: file.size,
      quality,
      maxWidth,
      maxHeight,
      bitrate
    });

    const startTime = Date.now();

    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(`${maxWidth}x${maxHeight}`)
      .videoBitrate(bitrate)
      .fps(fps)
      .outputOptions([
        '-preset fast', // Encoding speed vs compression efficiency
        '-crf 23', // Constant Rate Factor (18-28, lower = better quality)
        '-movflags +faststart', // Optimize for web streaming
        '-pix_fmt yuv420p' // Ensure compatibility
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        console.log(`Compression progress: ${percent}% done`);
        if (progressCallback) {
          // Compression takes 30% of total progress
          const adjustedPercent = Math.round((percent * 30) / 100);
          progressCallback(adjustedPercent, 'compressing');
        }
      })
      .on('end', () => {
        const endTime = Date.now();
        const compressionTime = (endTime - startTime) / 1000;
        
        // Read compressed file
        const compressedBuffer = fs.readFileSync(outputPath);
        const originalSize = file.size;
        const compressedSize = compressedBuffer.length;
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

        console.log('Video compression completed:', {
          originalSize: `${(originalSize / (1024 * 1024)).toFixed(2)} MB`,
          compressedSize: `${(compressedSize / (1024 * 1024)).toFixed(2)} MB`,
          compressionRatio: `${compressionRatio}%`,
          compressionTime: `${compressionTime}s`
        });

        // Clean up temporary files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        resolve({
          buffer: compressedBuffer,
          originalSize,
          compressedSize,
          compressionRatio: parseFloat(compressionRatio),
          compressionTime
        });
      })
      .on('error', (err) => {
        console.error('Video compression error:', err);
        
        // Clean up temporary files
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        
        reject(new Error(`Video compression failed: ${err.message}`));
      })
      .save(outputPath);
  });
};

/**
 * Get compression settings based on file size and quality preference
 * @param {number} fileSize - Original file size in bytes
 * @param {string} quality - Quality preference (low, medium, high)
 * @returns {Object} - Compression settings
 */
const getCompressionSettings = (fileSize, quality = 'medium') => {
  const sizeInMB = fileSize / (1024 * 1024);
  
  let settings = {
    quality,
    maxWidth: 1280,
    maxHeight: 720,
    bitrate: '1000k',
    fps: 30
  };

  // Adjust settings based on file size - now compresses all videos
  if (sizeInMB > 200) {
    // Very large files - aggressive compression
    settings.maxWidth = 854;
    settings.maxHeight = 480;
    settings.bitrate = '800k';
    settings.fps = 25;
  } else if (sizeInMB > 100) {
    // Large files - moderate compression
    settings.maxWidth = 1024;
    settings.maxHeight = 576;
    settings.bitrate = '900k';
    settings.fps = 28;
  } else if (sizeInMB > 50) {
    // Medium files - light compression
    settings.maxWidth = 1280;
    settings.maxHeight = 720;
    settings.bitrate = '1000k';
    settings.fps = 30;
  } else if (sizeInMB > 20) {
    // Small files - minimal compression
    settings.maxWidth = 1440;
    settings.maxHeight = 810;
    settings.bitrate = '1200k';
    settings.fps = 30;
  } else {
    // Very small files - very light compression
    settings.maxWidth = 1600;
    settings.maxHeight = 900;
    settings.bitrate = '1400k';
    settings.fps = 30;
  }

  // Adjust based on quality preference
  if (quality === 'low') {
    settings.maxWidth = Math.floor(settings.maxWidth * 0.8);
    settings.maxHeight = Math.floor(settings.maxHeight * 0.8);
    settings.bitrate = Math.floor(parseInt(settings.bitrate) * 0.7) + 'k';
  } else if (quality === 'high') {
    settings.maxWidth = Math.floor(settings.maxWidth * 1.2);
    settings.maxHeight = Math.floor(settings.maxHeight * 1.2);
    settings.bitrate = Math.floor(parseInt(settings.bitrate) * 1.3) + 'k';
  }

  return settings;
};

/**
 * Check if video compression is needed
 * @param {number} fileSize - File size in bytes
 * @param {number} threshold - Size threshold in MB (now 0 to compress all)
 * @returns {boolean} - Whether compression is needed
 */
const shouldCompress = (fileSize, threshold = 0) => {
  const sizeInMB = fileSize / (1024 * 1024);
  return sizeInMB > threshold; // Now compresses all videos
};

module.exports = {
  compressVideo,
  getCompressionSettings,
  shouldCompress
};
