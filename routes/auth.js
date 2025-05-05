const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const authController = require("../controllers/auth");

router.post("/users/signup", authController.postSignup);
router.post("/coaches/signup", authController.postSignup);
router.post("/login", authController.postLogin);
router.get("/me", auth, authController.getMe);
router.post("/forgot-password", authController.postForgotPassword);

module.exports = router;
