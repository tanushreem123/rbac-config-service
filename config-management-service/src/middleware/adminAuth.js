export function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token) {
    return res.status(401).json({
      error: "Admin token required",
    });
  }
console.log("Provided token:", token);
console.log("Expected token:", process.env.ADMIN_API_TOKEN);
  if (token !== process.env.ADMIN_API_TOKEN) {
    return res.status(403).json({
      error: "Invalid admin token",
    });
  }

  next();
}
