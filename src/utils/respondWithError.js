const createHttpError = (message, statusCode = 400, options = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = options.expose ?? statusCode < 500;
  return error;
};

const respondWithError = (
  res,
  error,
  { context, defaultStatusCode = 500, defaultMessage = "Terjadi kesalahan pada server." } = {}
) => {
  const statusCode = error?.statusCode || defaultStatusCode;
  const shouldExposeMessage = error?.expose === true || statusCode < 500;
  const message =
    shouldExposeMessage && error?.message ? error.message : defaultMessage;

  if (context) {
    console.error(`${context}:`, error?.message || error);
  } else {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
  });
};

module.exports = {
  createHttpError,
  respondWithError,
};
