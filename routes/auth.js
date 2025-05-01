const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const authController = require("../controllers/auth");

router.post("/users/signup", authController.postSignup);
router.post("/coaches/signup", authController.postSignup);
router.post("/login", authController.postLogin);

//回傳使用者資訊，方便前端判斷使用者登入狀態，調整右上角顯示狀態
router.get("/me", auth, authController.getMe);

module.exports = router;
