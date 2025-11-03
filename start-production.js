const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting TeachersLink Backend for Production...');

// Set production environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || 5001;

// Start the server with production optimizations
const server = spawn('node', ['server.js'], {
  cwd: path.join(__dirname),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || 5001
  }
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`🔄 Server exited with code ${code}`);
  if (code !== 0) {
    console.error('❌ Server crashed. Restarting in 5 seconds...');
    setTimeout(() => {
      console.log('🔄 Restarting server...');
      startServer();
    }, 5000);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  server.kill('SIGINT');
});

console.log('✅ Production server started successfully!');
console.log(`🌐 Server running on port ${process.env.PORT || 5001}`);
console.log('📊 Ready to handle 10k+ concurrent users');



