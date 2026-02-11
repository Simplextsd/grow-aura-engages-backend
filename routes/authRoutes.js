const express = require("express");
const router = express.Router();


const authController = require("../config/controllers/authController"); 

router.post("/login", authController.login);

module.exports = router;