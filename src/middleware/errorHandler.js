/* Global Error Handler */
export const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Handle database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    status = 503;
    message = 'Database connection failed';
  }

  // Handle missing database configuration
  if (!process.env.DATABASE_URL && (err.message?.includes('connect') || err.message?.includes('database'))) {
    status = 503;
    message = 'Database not configured - set DATABASE_URL environment variable';
  }

  console.error(`[${req.id}] Error:`, {
    status,
    message,
    path: req.path,
    method: req.method,
    user: req.user?.id,
    code: err.code,
    stack: err.stack,
  });

  res.status(status).json({
    error: message,
    requestId: req.id,
    code: err.code || null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
};

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}
