const express = require("express");
const router = express.Router();

// Path ko sahi kiya gaya hai kyunke controllers folder config ke andar hai
const { login } = require("../config/controllers/authController");

router.post("/login", login);

module.exports = router;