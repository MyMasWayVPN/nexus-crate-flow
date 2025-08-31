import { body, param, query, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Authentication validation
export const validateLogin = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

export const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address'),
  handleValidationErrors
];

// Container validation
export const validateCreateContainer = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Container name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Container name can only contain letters, numbers, underscores, and hyphens'),
  body('image')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Docker image is required'),
  body('ports')
    .optional()
    .isObject()
    .withMessage('Ports must be an object'),
  body('environment')
    .optional()
    .isArray()
    .withMessage('Environment variables must be an array'),
  body('volumes')
    .optional()
    .isArray()
    .withMessage('Volumes must be an array'),
  body('memory')
    .optional()
    .matches(/^\d+[bkmg]?$/i)
    .withMessage('Memory must be in format like 512m, 1g, etc.'),
  body('cpu')
    .optional()
    .isFloat({ min: 0.1, max: 8 })
    .withMessage('CPU must be between 0.1 and 8'),
  body('startupScript')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Startup script must be less than 1000 characters'),
  handleValidationErrors
];

export const validateUpdateContainer = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Container name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Container name can only contain letters, numbers, underscores, and hyphens'),
  body('startupScript')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Startup script must be less than 1000 characters'),
  handleValidationErrors
];

export const validateContainerId = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  handleValidationErrors
];

// File management validation
export const validateFilePath = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  query('path')
    .optional()
    .trim()
    .custom((value) => {
      // Basic path validation - prevent directory traversal
      if (value && (value.includes('../') || value.includes('..\\') || value.startsWith('/'))) {
        throw new Error('Invalid file path');
      }
      return true;
    }),
  handleValidationErrors
];

export const validateFileUpload = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  body('path')
    .trim()
    .isLength({ min: 1 })
    .withMessage('File path is required')
    .custom((value) => {
      if (value.includes('../') || value.includes('..\\') || value.startsWith('/')) {
        throw new Error('Invalid file path');
      }
      return true;
    }),
  handleValidationErrors
];

// Settings validation
export const validateContainerSettings = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  body('cloudflareToken')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Cloudflare token must be less than 200 characters'),
  body('tunnelEnabled')
    .optional()
    .isBoolean()
    .withMessage('Tunnel enabled must be a boolean'),
  body('autoRestart')
    .optional()
    .isBoolean()
    .withMessage('Auto restart must be a boolean'),
  body('maxMemory')
    .optional()
    .matches(/^\d+[bkmg]?$/i)
    .withMessage('Max memory must be in format like 512m, 1g, etc.'),
  body('maxCpu')
    .optional()
    .isFloat({ min: 0.1, max: 8 })
    .withMessage('Max CPU must be between 0.1 and 8'),
  handleValidationErrors
];

// Log validation
export const validateLogQuery = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  query('tail')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Tail must be between 1 and 10000'),
  query('since')
    .optional()
    .isISO8601()
    .withMessage('Since must be a valid ISO 8601 date'),
  query('until')
    .optional()
    .isISO8601()
    .withMessage('Until must be a valid ISO 8601 date'),
  query('follow')
    .optional()
    .isBoolean()
    .withMessage('Follow must be a boolean'),
  handleValidationErrors
];

// Command execution validation
export const validateExecuteCommand = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Container ID is required'),
  body('command')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Command must be between 1 and 1000 characters'),
  body('workingDir')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Working directory must be less than 500 characters'),
  body('user')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('User must be less than 100 characters'),
  handleValidationErrors
];

// Generic ID validation
export const validateId = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('ID is required'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .isIn(['name', 'created_at', 'updated_at', 'status'])
    .withMessage('Sort field must be one of: name, created_at, updated_at, status'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be either asc or desc'),
  handleValidationErrors
];
