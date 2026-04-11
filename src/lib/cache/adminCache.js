const { createMemoryTtlCache } = require("./memoryTtlCache");

const adminCache = createMemoryTtlCache();

const ADMIN_CACHE_KEYS = {
  dashboardSummary: "admin:dashboard:summary",
  ordersSummary: "admin:orders:summary",
  customersList: "admin:customers:list",
};

const ADMIN_CACHE_PREFIXES = {
  auth: "admin:auth:",
  ordersSummary: `${ADMIN_CACHE_KEYS.ordersSummary}:`,
};

const ADMIN_CACHE_TTLS = {
  adminAuth: 20 * 1000,
  dashboardSummary: 8 * 1000,
  ordersSummary: 5 * 1000,
  customersList: 45 * 1000,
};

const getAdminAuthCacheKey = (tokenHash) =>
  `${ADMIN_CACHE_PREFIXES.auth}${tokenHash}`;

const getOrdersSummaryCacheKey = (since) =>
  `${ADMIN_CACHE_PREFIXES.ordersSummary}${since || "all"}`;

const invalidateOrderDerivedCaches = () => {
  adminCache.deleteMany([
    ADMIN_CACHE_KEYS.dashboardSummary,
    ADMIN_CACHE_KEYS.customersList,
  ]);
  adminCache.clearByPrefix(ADMIN_CACHE_PREFIXES.ordersSummary);
};

module.exports = {
  adminCache,
  ADMIN_CACHE_KEYS,
  ADMIN_CACHE_PREFIXES,
  ADMIN_CACHE_TTLS,
  getAdminAuthCacheKey,
  getOrdersSummaryCacheKey,
  invalidateOrderDerivedCaches,
};
