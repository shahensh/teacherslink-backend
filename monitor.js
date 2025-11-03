const os = require('os');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.logFile = path.join(__dirname, 'logs', 'performance.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  getSystemStats() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        cores: cpus.length,
        model: cpus[0].model,
        speed: cpus[0].speed,
        usage: process.cpuUsage()
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usage: (usedMem / totalMem) * 100
      },
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch()
    };
  }

  logPerformance() {
    const stats = this.getSystemStats();
    const logEntry = JSON.stringify(stats) + '\n';
    
    fs.appendFileSync(this.logFile, logEntry);
    
    // Log to console if memory usage is high
    if (stats.memory.usage > 80) {
      console.warn(`⚠️  High memory usage: ${stats.memory.usage.toFixed(2)}%`);
    }
    
    // Log to console if CPU usage is high
    const cpuUsage = process.cpuUsage();
    if (cpuUsage.user > 1000000 || cpuUsage.system > 1000000) {
      console.warn(`⚠️  High CPU usage: User: ${cpuUsage.user}, System: ${cpuUsage.system}`);
    }
  }

  startMonitoring(interval = 30000) {
    console.log('📊 Starting performance monitoring...');
    console.log(`📝 Logging to: ${this.logFile}`);
    console.log(`⏱️  Monitoring interval: ${interval}ms`);
    
    setInterval(() => {
      this.logPerformance();
    }, interval);
  }

  getHealthStatus() {
    const stats = this.getSystemStats();
    const health = {
      status: 'healthy',
      timestamp: stats.timestamp,
      uptime: stats.uptime,
      memory: {
        usage: stats.memory.usage,
        status: stats.memory.usage < 80 ? 'healthy' : 'warning'
      },
      cpu: {
        cores: stats.cpu.cores,
        status: 'healthy'
      }
    };

    if (stats.memory.usage > 90) {
      health.status = 'critical';
      health.memory.status = 'critical';
    } else if (stats.memory.usage > 80) {
      health.status = 'warning';
    }

    return health;
  }
}

// Start monitoring if run directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.startMonitoring();
  
  // Health check endpoint
  const express = require('express');
  const app = express();
  
  app.get('/health', (req, res) => {
    const health = monitor.getHealthStatus();
    res.json(health);
  });
  
  app.listen(3001, () => {
    console.log('🏥 Health check server running on port 3001');
  });
}

module.exports = PerformanceMonitor;



