const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const authController = require("../controllers/auth");

//使用者註冊
router.post("/users/signup", authController.postSignup);
//教練註冊
router.post("/coaches/signup", authController.postSignup);
//管理者註冊(開發用)
router.post("/admins/signup", authController.postAdminSignup);
//登入
router.post("/login", authController.postLogin);
//驗證登入狀態
router.get("/me", auth, authController.getMe);
//忘記密碼
router.post("/forgot-password", authController.postForgotPassword);
//重設密碼
router.patch("/reset-password", authController.patchResetPassword);

module.exports = router;
