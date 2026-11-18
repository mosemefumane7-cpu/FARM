/**
 * Central error handler. Every controller forwards failures here so the
 * client always receives a consistent JSON shape and a correct status code.
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details,
    });
  }

  // MySQL constraint violations mapped to meaningful client errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'A record with these unique details already exists.',
    });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'The referenced record does not exist.',
    });
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(400).json({
      success: false,
      message: 'This record is referenced by other records and cannot be removed.',
    });
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(500).json({
      success: false,
      message: 'The database is currently unreachable. Please try again shortly.',
    });
  }

  console.error('[unhandled]', error);
  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
  });
};

/** Wraps an async controller so rejected promises reach the error handler. */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
