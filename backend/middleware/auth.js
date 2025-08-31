import jwt from 'jsonwebtoken';
import { database } from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted (optional - for logout functionality)
    const tokenHash = Buffer.from(token).toString('base64');
    const blacklistedToken = await database.get(
      'SELECT id FROM sessions WHERE token_hash = ? AND expires_at > datetime("now")',
      [tokenHash]
    );

    if (blacklistedToken) {
      return res.status(401).json({ 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Get user information
    const user = await database.get(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Add user info to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredRoles,
        current: userRoles
      });
    }

    next();
  };
};

export const generateToken = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

export const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return false;
    }

    const tokenHash = Buffer.from(token).toString('base64');
    const expiresAt = new Date(decoded.exp * 1000);

    await database.run(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [decoded.userId, tokenHash, expiresAt.toISOString()]
    );

    return true;
  } catch (error) {
    console.error('Error blacklisting token:', error);
    return false;
  }
};

// Cleanup expired tokens (run periodically)
export const cleanupExpiredTokens = async () => {
  try {
    const result = await database.run(
      'DELETE FROM sessions WHERE expires_at <= datetime("now")'
    );
    
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired tokens`);
    }
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
};

// Optional: Rate limiting per user
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create user request history
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const requests = userRequests.get(userId);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    userRequests.set(userId, recentRequests);

    // Check if user exceeded rate limit
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    
    next();
  };
};
