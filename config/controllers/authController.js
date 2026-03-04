const db = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

exports.login = async (req, res) => {
  try {

    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const user = rows[0];

    let isMatch = false;

    // agar bcrypt hashed password hai
    if (user.password.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(password, user.password);
    } 
    // agar plain text hai
    else {
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        pages: user.permissions ? JSON.parse(user.permissions) : []
      }
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};