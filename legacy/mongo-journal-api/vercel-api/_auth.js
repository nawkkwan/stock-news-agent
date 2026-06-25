export function isAdminRequest(req) {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) {
    return false;
  }
  return req.headers["x-admin-token"] === expectedToken;
}

export function requireAdminToken(req, res) {
  if (!process.env.ADMIN_TOKEN) {
    res.status(500).json({ error: "ADMIN_TOKEN is not configured" });
    return false;
  }
  if (!isAdminRequest(req)) {
    res.status(401).json({ error: "Invalid admin token" });
    return false;
  }
  return true;
}
