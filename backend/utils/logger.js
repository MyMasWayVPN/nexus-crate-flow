import fs from 'fs/promises';
import path from 'path';

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logPath = './logs/system.log';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.logPath);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  async writeToFile(formattedMessage) {
    try {
      await fs.appendFile(this.logPath, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Always log to console
    console.log(formattedMessage);
    
    // Also log to file in production
    if (process.env.NODE_ENV === 'production') {
      await this.writeToFile(formattedMessage);
    }
  }

  async error(message, meta = {}) {
    await this.log('error', message, meta);
  }

  async warn(message, meta = {}) {
    await this.log('warn', message, meta);
  }

  async info(message, meta = {}) {
    await this.log('info', message, meta);
  }

  async debug(message, meta = {}) {
    await this.log('debug', message, meta);
  }

  // Log HTTP requests
  async logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      response_time: `${responseTime}ms`,
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      user_id: req.user ? req.user.id : null
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    await this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, logData);
  }

  // Log container operations
  async logContainerOperation(operation, containerId, containerName, userId, success = true, error = null) {
    const logData = {
      operation,
      container_id: containerId,
      container_name: containerName,
      user_id: userId,
      success,
      error: error ? error.message : null
    };

    const level = success ? 'info' : 'error';
    const message = `Container ${operation}: ${containerName} (${containerId})`;
    
    await this.log(level, message, logData);
  }

  // Log authentication events
  async logAuth(event, username, success = true, ip = null, error = null) {
    const logData = {
      event,
      username,
      success,
      ip,
      error: error ? error.message : null
    };

    const level = success ? 'info' : 'warn';
    const message = `Auth ${event}: ${username}`;
    
    await this.log(level, message, logData);
  }

  // Log system events
  async logSystem(event, details = {}) {
    await this.log('info', `System ${event}`, details);
  }

  // Rotate log files
  async rotateLogs() {
    try {
      const stats = await fs.stat(this.logPath);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.logPath}.${timestamp}`;
        
        await fs.rename(this.logPath, rotatedPath);
        await this.info('Log file rotated', { rotated_to: rotatedPath });
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  // Clean up old log files
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const logDir = path.dirname(this.logPath);
      const files = await fs.readdir(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let cleanedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('system.log.') && file !== 'system.log') {
          const filePath = path.join(logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        await this.info(`Cleaned up ${cleanedCount} old log files`);
      }
      
      return cleanedCount;
    } catch (error) {
      await this.error('Failed to cleanup old logs', { error: error.message });
      return 0;
    }
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
export { Logger };
