import express from 'express';
import { User } from '../models/User.js';
import { generateToken, blacklistToken, authenticateToken } from '../middleware/auth.js';
import { validateLogin, validateRegister } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Find user with password
  const userData = await User.findByUsernameWithPassword(username);
  if (!userData) {
    return res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Validate password
  const isValidPassword = await User.validatePassword(password, userData.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Create user instance (without password)
  const user = new User(userData);
  
  // Update last login
  await user.updateLastLogin();

  // Generate JWT token
  const token = generateToken(user);

  res.json({
    message: 'Login successful',
    user: user.toJSON(),
    token,
    expires_in: process.env.JWT_EXPIRES_IN || '24h'
  });
}));

// POST /api/auth/register
router.post('/register', validateRegister, asyncHandler(async (req, res) => {
  const { username, password, email } = req.body;

  // Check if user already exists
  const existingUser = await User.exists(username, email);
  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists',
      code: 'USER_EXISTS'
    });
  }

  // Create new user
  const user = await User.create({
    username,
    password,
    email,
    role: 'user' // Default role
  });

  // Generate JWT token
  const token = generateToken(user);

  res.status(201).json({
    message: 'User created successfully',
    user: user.toJSON(),
    token,
    expires_in: process.env.JWT_EXPIRES_IN || '24h'
  });
}));

// POST /api/auth/logout
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  const token = req.token;

  // Blacklist the token
  const blacklisted = await blacklistToken(token);
  
  if (blacklisted) {
    res.json({
      message: 'Logout successful'
    });
  } else {
    res.status(500).json({
      error: 'Failed to logout',
      code: 'LOGOUT_FAILED'
    });
  }
}));

// GET /api/auth/me
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  res.json({
    user: user.toJSON()
  });
}));

// PUT /api/auth/profile
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const { username, email } = req.body;
  const userId = req.user.id;

  // Check if new username/email already exists (excluding current user)
  if (username || email) {
    const existingUser = await User.findByUsername(username);
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        error: 'Username already taken',
        code: 'USERNAME_TAKEN'
      });
    }
  }

  // Update user profile
  const updatedUser = await User.update(userId, { username, email });
  
  if (!updatedUser) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  res.json({
    message: 'Profile updated successfully',
    user: updatedUser.toJSON()
  });
}));

// PUT /api/auth/password
router.put('/password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Current password and new password are required',
      code: 'MISSING_PASSWORDS'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      error: 'New password must be at least 6 characters long',
      code: 'PASSWORD_TOO_SHORT'
    });
  }

  // Get user with password
  const userData = await User.findByUsernameWithPassword(req.user.username);
  if (!userData) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  // Validate current password
  const isValidPassword = await User.validatePassword(currentPassword, userData.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      error: 'Current password is incorrect',
      code: 'INVALID_CURRENT_PASSWORD'
    });
  }

  // Update password
  const updated = await User.updatePassword(userId, newPassword);
  
  if (!updated) {
    return res.status(500).json({
      error: 'Failed to update password',
      code: 'PASSWORD_UPDATE_FAILED'
    });
  }

  res.json({
    message: 'Password updated successfully'
  });
}));

// GET /api/auth/verify
router.get('/verify', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    expires_at: new Date(req.user.exp * 1000).toISOString()
  });
}));

// POST /api/auth/refresh
router.post('/refresh', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  // Generate new token
  const newToken = generateToken(user);

  // Optionally blacklist old token
  await blacklistToken(req.token);

  res.json({
    message: 'Token refreshed successfully',
    token: newToken,
    expires_in: process.env.JWT_EXPIRES_IN || '24h'
  });
}));

export default router;
