const { createHash } = require("crypto");

const supabase = require("../config/supabase");
const supabaseAuth = require("../config/supabaseAuth");
const {
  adminCache,
  ADMIN_CACHE_TTLS,
  getAdminAuthCacheKey,
} = require("../lib/cache/adminCache");

function getBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return null;
  }

  return headerValue.slice("Bearer ".length).trim();
}

function getTokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveAdminFromToken(token) {
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return { statusCode: 401 };
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("id, email, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (adminError || !adminUser) {
    return { statusCode: 403 };
  }

  return {
    statusCode: 200,
    admin: {
      id: adminUser.id,
      email: adminUser.email || user.email,
      role: adminUser.role,
      user,
    },
  };
}

async function requireAdminAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const cacheKey = getAdminAuthCacheKey(getTokenHash(token));
    const cachedAdmin = adminCache.get(cacheKey);

    if (cachedAdmin) {
      req.admin = cachedAdmin;
      return next();
    }

    const result = await resolveAdminFromToken(token);

    if (result.statusCode === 401) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (result.statusCode === 403) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    adminCache.set(cacheKey, result.admin, ADMIN_CACHE_TTLS.adminAuth);
    req.admin = result.admin;

    next();
  } catch (err) {
    console.error("Admin auth error:", err.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

module.exports = requireAdminAuth;
