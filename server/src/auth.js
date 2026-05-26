export function requireAdminToken(req, res, next) {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) {
    res.status(500).json({ error: "ADMIN_TOKEN is not configured" });
    return;
  }

  const providedToken = req.get("x-admin-token") || "";
  if (providedToken !== expectedToken) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }

  next();
}
