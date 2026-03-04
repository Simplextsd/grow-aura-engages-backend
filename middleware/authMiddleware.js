const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "default_secret",
    (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid token" });
      }

      req.user = decoded;
      next();
    }
  );
};

module.exports = authenticateToken;