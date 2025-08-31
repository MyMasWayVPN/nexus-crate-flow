export const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    code = 'INVALID_FORMAT';
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    message = 'Data constraint violation';
    code = 'CONSTRAINT_ERROR';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    message = 'Resource not found';
    code = 'RESOURCE_NOT_FOUND';
  } else if (err.code === 'EACCES') {
    statusCode = 403;
    message = 'Permission denied';
    code = 'PERMISSION_DENIED';
  }

  // Docker-specific errors
  if (err.message && err.message.includes('Docker')) {
    if (err.message.includes('not found')) {
      statusCode = 404;
      code = 'CONTAINER_NOT_FOUND';
    } else if (err.message.includes('already running')) {
      statusCode = 409;
      code = 'CONTAINER_ALREADY_RUNNING';
    } else if (err.message.includes('not running')) {
      statusCode = 409;
      code = 'CONTAINER_NOT_RUNNING';
    }
  }

  const errorResponse = {
    error: message,
    code: code,
    timestamp: new Date().toISOString()
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
};
