import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { Container } from '../models/Container.js';

export class LogService {
  constructor() {
    this.logWatchers = new Map();
    this.logStreams = new Map();
    this.logPath = process.env.CONTAINER_LOG_PATH || './logs';
  }

  static async initialize() {
    const instance = new LogService();
    await instance.ensureLogDirectory();
    await instance.startLogWatching();
    return instance;
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logPath, { recursive: true });
      console.log(`📁 Log directory ensured: ${this.logPath}`);
    } catch (error) {
      console.error('Error creating log directory:', error);
      throw error;
    }
  }

  getContainerLogPath(containerId) {
    return path.join(this.logPath, `container-${containerId}`);
  }

  getLogFilePath(containerId, logType = 'application') {
    const containerLogPath = this.getContainerLogPath(containerId);
    return path.join(containerLogPath, `${logType}.log`);
  }

  async createContainerLogDirectory(containerId) {
    const containerLogPath = this.getContainerLogPath(containerId);
    
    try {
      await fs.mkdir(containerLogPath, { recursive: true });
      
      // Create default log files
      const logFiles = ['application.log', 'startup.log', 'error.log'];
      
      for (const logFile of logFiles) {
        const logFilePath = path.join(containerLogPath, logFile);
        try {
          await fs.access(logFilePath);
        } catch {
          // File doesn't exist, create it
          await fs.writeFile(logFilePath, '');
        }
      }
      
      console.log(`📁 Container log directory created: ${containerLogPath}`);
    } catch (error) {
      console.error(`Error creating container log directory for ${containerId}:`, error);
      throw error;
    }
  }

  async writeLog(containerId, content, logType = 'application') {
    try {
      // Ensure container log directory exists
      await this.createContainerLogDirectory(containerId);
      
      const logFilePath = this.getLogFilePath(containerId, logType);
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${content}\n`;
      
      await fs.appendFile(logFilePath, logEntry);
      
      // Also store in database
      const container = await Container.findById(containerId);
      if (container) {
        await container.addLog(content, logType);
      }
      
      // Notify WebSocket clients
      this.notifyLogUpdate(containerId, {
        timestamp,
        content,
        source: 'application',
        type: logType
      });
      
    } catch (error) {
      console.error(`Error writing log for container ${containerId}:`, error);
      throw error;
    }
  }

  async readLogs(containerId, options = {}) {
    try {
      const { 
        logType = 'application', 
        tail = 100, 
        since = null,
        follow = false 
      } = options;
      
      const logFilePath = this.getLogFilePath(containerId, logType);
      
      try {
        const content = await fs.readFile(logFilePath, 'utf8');
        let lines = content.split('\n').filter(line => line.trim());
        
        // Filter by timestamp if since is provided
        if (since) {
          const sinceDate = new Date(since);
          lines = lines.filter(line => {
            const timestampMatch = line.match(/^\[([^\]]+)\]/);
            if (timestampMatch) {
              const logDate = new Date(timestampMatch[1]);
              return logDate >= sinceDate;
            }
            return true;
          });
        }
        
        // Get last N lines
        if (tail > 0) {
          lines = lines.slice(-tail);
        }
        
        // Parse log entries
        const logs = lines.map(line => {
          const timestampMatch = line.match(/^\[([^\]]+)\] (.*)$/);
          if (timestampMatch) {
            return {
              timestamp: timestampMatch[1],
              content: timestampMatch[2],
              source: 'file',
              type: logType
            };
          }
          return {
            timestamp: new Date().toISOString(),
            content: line,
            source: 'file',
            type: logType
          };
        });
        
        return logs;
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Log file doesn't exist yet
          return [];
        }
        throw error;
      }
      
    } catch (error) {
      console.error(`Error reading logs for container ${containerId}:`, error);
      throw error;
    }
  }

  async clearLogs(containerId, logType = 'application') {
    try {
      const logFilePath = this.getLogFilePath(containerId, logType);
      await fs.writeFile(logFilePath, '');
      
      // Also clear database logs
      const container = await Container.findById(containerId);
      if (container) {
        await container.addLog(`${logType} logs cleared`, 'info');
      }
      
      console.log(`🧹 Cleared ${logType} logs for container ${containerId}`);
      
    } catch (error) {
      console.error(`Error clearing logs for container ${containerId}:`, error);
      throw error;
    }
  }

  async startLogWatching() {
    try {
      // Watch for changes in log files
      const watcher = chokidar.watch(`${this.logPath}/*/*.log`, {
        persistent: true,
        ignoreInitial: true
      });
      
      watcher.on('change', async (filePath) => {
        try {
          const pathParts = filePath.split(path.sep);
          const containerDir = pathParts[pathParts.length - 2];
          const logFile = pathParts[pathParts.length - 1];
          
          const containerIdMatch = containerDir.match(/^container-(.+)$/);
          if (!containerIdMatch) return;
          
          const containerId = containerIdMatch[1];
          const logType = path.basename(logFile, '.log');
          
          // Read the last few lines of the changed file
          const newLogs = await this.readLogs(containerId, { 
            logType, 
            tail: 10 
          });
          
          // Notify WebSocket clients about new logs
          if (newLogs.length > 0) {
            const latestLog = newLogs[newLogs.length - 1];
            this.notifyLogUpdate(containerId, latestLog);
          }
          
        } catch (error) {
          console.error('Error processing log file change:', error);
        }
      });
      
      console.log('👁️ Log file watching started');
      
    } catch (error) {
      console.error('Error starting log watching:', error);
      throw error;
    }
  }

  notifyLogUpdate(containerId, logEntry) {
    // This will be implemented when WebSocket service is created
    // For now, just emit an event that can be listened to
    if (this.logStreams.has(containerId)) {
      const streams = this.logStreams.get(containerId);
      streams.forEach(stream => {
        try {
          stream.write(JSON.stringify(logEntry) + '\n');
        } catch (error) {
          console.error('Error writing to log stream:', error);
        }
      });
    }
  }

  addLogStream(containerId, stream) {
    if (!this.logStreams.has(containerId)) {
      this.logStreams.set(containerId, new Set());
    }
    this.logStreams.get(containerId).add(stream);
  }

  removeLogStream(containerId, stream) {
    if (this.logStreams.has(containerId)) {
      this.logStreams.get(containerId).delete(stream);
      if (this.logStreams.get(containerId).size === 0) {
        this.logStreams.delete(containerId);
      }
    }
  }

  async getLogStats(containerId) {
    try {
      const containerLogPath = this.getContainerLogPath(containerId);
      const stats = {
        container_id: containerId,
        log_files: {},
        total_size: 0
      };
      
      try {
        const files = await fs.readdir(containerLogPath);
        
        for (const file of files) {
          if (file.endsWith('.log')) {
            const filePath = path.join(containerLogPath, file);
            const fileStat = await fs.stat(filePath);
            const logType = path.basename(file, '.log');
            
            stats.log_files[logType] = {
              size: fileStat.size,
              modified: fileStat.mtime,
              lines: 0 // Will be calculated if needed
            };
            
            stats.total_size += fileStat.size;
          }
        }
        
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      return stats;
      
    } catch (error) {
      console.error(`Error getting log stats for container ${containerId}:`, error);
      throw error;
    }
  }

  async rotateLogs(containerId, maxSize = 10 * 1024 * 1024) { // 10MB default
    try {
      const containerLogPath = this.getContainerLogPath(containerId);
      
      try {
        const files = await fs.readdir(containerLogPath);
        
        for (const file of files) {
          if (file.endsWith('.log')) {
            const filePath = path.join(containerLogPath, file);
            const fileStat = await fs.stat(filePath);
            
            if (fileStat.size > maxSize) {
              // Rotate the log file
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const rotatedPath = path.join(containerLogPath, `${file}.${timestamp}`);
              
              await fs.rename(filePath, rotatedPath);
              await fs.writeFile(filePath, '');
              
              console.log(`🔄 Rotated log file: ${file} -> ${path.basename(rotatedPath)}`);
              
              // Log the rotation
              await this.writeLog(containerId, `Log file rotated: ${file}`, 'info');
            }
          }
        }
        
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
    } catch (error) {
      console.error(`Error rotating logs for container ${containerId}:`, error);
      throw error;
    }
  }

  async cleanupOldLogs(retentionDays = 30) {
    try {
      console.log(`🧹 Cleaning up logs older than ${retentionDays} days...`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let cleanedCount = 0;
      
      try {
        const containerDirs = await fs.readdir(this.logPath);
        
        for (const containerDir of containerDirs) {
          if (!containerDir.startsWith('container-')) continue;
          
          const containerLogPath = path.join(this.logPath, containerDir);
          
          try {
            const files = await fs.readdir(containerLogPath);
            
            for (const file of files) {
              const filePath = path.join(containerLogPath, file);
              const fileStat = await fs.stat(filePath);
              
              if (fileStat.mtime < cutoffDate && file.includes('.log.')) {
                // This is a rotated log file older than retention period
                await fs.unlink(filePath);
                cleanedCount++;
                console.log(`🗑️ Deleted old log file: ${file}`);
              }
            }
            
          } catch (error) {
            console.error(`Error cleaning logs in ${containerDir}:`, error);
          }
        }
        
      } catch (error) {
        console.error('Error reading log directory:', error);
      }
      
      console.log(`✅ Log cleanup completed: ${cleanedCount} files deleted`);
      return { cleaned: cleanedCount };
      
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      throw error;
    }
  }

  async exportLogs(containerId, format = 'json') {
    try {
      const container = await Container.findById(containerId);
      if (!container) {
        throw new Error('Container not found');
      }
      
      // Get logs from all sources
      const applicationLogs = await this.readLogs(containerId, { logType: 'application', tail: 10000 });
      const startupLogs = await this.readLogs(containerId, { logType: 'startup', tail: 1000 });
      const errorLogs = await this.readLogs(containerId, { logType: 'error', tail: 1000 });
      
      const allLogs = [
        ...applicationLogs,
        ...startupLogs,
        ...errorLogs
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const exportData = {
        container: {
          id: container.id,
          name: container.name,
          exported_at: new Date().toISOString()
        },
        logs: allLogs,
        stats: {
          total_logs: allLogs.length,
          application_logs: applicationLogs.length,
          startup_logs: startupLogs.length,
          error_logs: errorLogs.length
        }
      };
      
      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else {
        // Text format
        const header = `Container: ${container.name} (${container.id})\nExported: ${exportData.container.exported_at}\n${'='.repeat(50)}\n\n`;
        const logText = allLogs
          .map(log => `[${log.timestamp}] [${log.type}] ${log.content}`)
          .join('\n');
        
        return header + logText;
      }
      
    } catch (error) {
      console.error(`Error exporting logs for container ${containerId}:`, error);
      throw error;
    }
  }
}

export default LogService;
