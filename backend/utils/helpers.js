import crypto from 'crypto';
import path from 'path';
import { promisify } from 'util';

// Promisify crypto functions
const randomBytes = promisify(crypto.randomBytes);

export class Helpers {
  // Generate random string
  static async generateRandomString(length = 32) {
    const buffer = await randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
  }

  // Generate container ID
  static generateContainerId() {
    return crypto.randomBytes(6).toString('hex');
  }

  // Validate container name
  static isValidContainerName(name) {
    // Container names must be alphanumeric with hyphens and underscores
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(name) && name.length >= 1 && name.length <= 100;
  }

  // Sanitize file path
  static sanitizePath(filePath) {
    // Remove any path traversal attempts
    return path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  }

  // Parse memory string (e.g., "512m", "1g") to bytes
  static parseMemoryToBytes(memory) {
    if (!memory || typeof memory !== 'string') return 0;
    
    const units = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024,
      't': 1024 * 1024 * 1024 * 1024
    };
    
    const match = memory.toLowerCase().match(/^(\d+(?:\.\d+)?)([bkmgt]?)$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return Math.floor(value * (units[unit] || 1));
  }

  // Format bytes to human readable string
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Parse CPU string to shares
  static parseCpuToShares(cpu) {
    if (!cpu) return 0;
    const cpuFloat = parseFloat(cpu);
    return Math.floor(cpuFloat * 1024);
  }

  // Validate email format
  static isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Generate secure password hash
  static async hashPassword(password, rounds = 12) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, rounds);
  }

  // Validate password strength
  static validatePasswordStrength(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [
      password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    ].filter(Boolean).length;
    
    return {
      valid: score >= 3 && password.length >= minLength,
      score,
      requirements: {
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar
      }
    };
  }

  // Escape shell command arguments
  static escapeShellArg(arg) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  // Parse environment variables string to array
  static parseEnvironmentVars(envString) {
    if (!envString) return [];
    
    return envString
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes('='))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        return `${key.trim()}=${valueParts.join('=').trim()}`;
      });
  }

  // Format environment variables array to string
  static formatEnvironmentVars(envArray) {
    if (!Array.isArray(envArray)) return '';
    return envArray.join('\n');
  }

  // Parse port mappings string to object
  static parsePortMappings(portString) {
    if (!portString) return {};
    
    const mappings = {};
    const pairs = portString.split(',').map(p => p.trim());
    
    for (const pair of pairs) {
      const [host, container] = pair.split(':').map(p => p.trim());
      if (host && container) {
        mappings[container] = host;
      }
    }
    
    return mappings;
  }

  // Format port mappings object to string
  static formatPortMappings(portObject) {
    if (!portObject || typeof portObject !== 'object') return '';
    
    return Object.entries(portObject)
      .map(([container, host]) => `${host}:${container}`)
      .join(', ');
  }

  // Validate port number
  static isValidPort(port) {
    const portNum = parseInt(port);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
  }

  // Generate Docker container name
  static generateDockerName(baseName) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${baseName}-${timestamp}-${random}`.toLowerCase();
  }

  // Validate Docker image name
  static isValidDockerImage(image) {
    // Basic Docker image name validation
    const regex = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9._-]+)?$/;
    return regex.test(image);
  }

  // Parse Docker image to components
  static parseDockerImage(image) {
    const parts = image.split(':');
    const tag = parts.length > 1 ? parts.pop() : 'latest';
    const name = parts.join(':');
    
    const nameParts = name.split('/');
    const repository = nameParts.pop();
    const registry = nameParts.length > 0 ? nameParts.join('/') : 'docker.io';
    
    return {
      registry,
      repository,
      tag,
      full: image
    };
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Deep clone object
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  // Retry function with exponential backoff
  static async retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Check if string is JSON
  static isJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  // Safe JSON parse
  static safeJSONParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  }

  // Generate UUID v4
  static generateUUID() {
    return crypto.randomUUID();
  }

  // Validate UUID
  static isValidUUID(uuid) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  // Get file extension
  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase().slice(1);
  }

  // Check if file is text file
  static isTextFile(filename) {
    const textExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss',
      'py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'sh', 'bash',
      'yml', 'yaml', 'xml', 'sql', 'log', 'conf', 'config', 'ini', 'env'
    ];
    
    const extension = this.getFileExtension(filename);
    return textExtensions.includes(extension);
  }

  // Format duration in milliseconds to human readable
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Get relative time string
  static getRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  // Mask sensitive data
  static maskSensitiveData(data, fields = ['password', 'token', 'secret', 'key']) {
    if (typeof data !== 'object' || data === null) return data;
    
    const masked = { ...data };
    
    for (const field of fields) {
      if (masked[field]) {
        masked[field] = '***MASKED***';
      }
    }
    
    return masked;
  }
}

export default Helpers;
