module.exports = {
  apps: [{
    name: 'teacherslink-backend',
    script: 'server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    // Production optimizations
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Auto-restart settings
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_interval: 30000,
    
    // Advanced settings for 10k+ users
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Environment specific settings
    env_production: {
      NODE_ENV: 'production',
      PORT: 5001,
      // Add your production database URL here
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/teacherslink',
      // Add your JWT secret here
      JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      // Add your Cloudinary credentials here
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
    }
  }],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-git-repo',
      path: '/var/www/teacherslink-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};



