exports.login = (req, res) => {
  const { email, password } = req.body;

  // simple validation
  if (!email || !password) {
    return res.status(400).json({
      message: "Email aur password zaroori hai"
    });
  }

  // temporary (no DB yet)
  if (email === "admin@test.com" && password === "123456") {
    return res.status(200).json({
      message: "Login successful",
      token: "fake-jwt-token",
      user: {
        role: "admin",
        email
      }
    });
  }

  return res.status(401).json({
    message: "Invalid credentials"
  });
};
