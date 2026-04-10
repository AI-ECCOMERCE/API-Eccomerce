const stores = new Map();

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "anonymous";
};

const createRateLimiter = ({
  windowMs,
  maxRequests,
  keyPrefix,
  message,
}) => {
  return (req, res, next) => {
    const clientKey = `${keyPrefix}:${getClientIp(req)}`;
    const now = Date.now();
    const activeTimestamps = (stores.get(clientKey) || []).filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (activeTimestamps.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: message,
      });
    }

    activeTimestamps.push(now);
    stores.set(clientKey, activeTimestamps);
    next();
  };
};

module.exports = {
  createRateLimiter,
};
