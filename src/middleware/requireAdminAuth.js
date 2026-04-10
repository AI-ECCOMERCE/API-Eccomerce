const supabase = require("../config/supabase");
const supabaseAuth = require("../config/supabaseAuth");

function getBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return null;
  }

  return headerValue.slice("Bearer ".length).trim();
}

async function requireAdminAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email, role, is_active")
      .eq("id", user.id)
      .eq("is_active", true)
      .single();

    if (adminError || !adminUser) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    req.admin = {
      id: adminUser.id,
      email: adminUser.email || user.email,
      role: adminUser.role,
      user,
    };

    next();
  } catch (err) {
    console.error("Admin auth error:", err.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

module.exports = requireAdminAuth;
