const express = require("express");
const router = express.Router();

const userController = require("../config/controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

/* Get all users */

router.get(
  "/users",
  authMiddleware,
  roleMiddleware("admin"),
  userController.getAllUsers
);

/* Create user */

router.post(
  "/users",
  authMiddleware,
  roleMiddleware("admin"),
  userController.createUser
);

/* Delete user */

router.delete(
  "/users/:id",
  authMiddleware,
  roleMiddleware("admin"),
  userController.deleteUser
);

module.exports = router;