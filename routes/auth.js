const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const AppDataSource = require("../db/data-source");
const auth = require("../middlewares/auth");

const User = require("../entities/User");
const Coach = require("../entities/Coach");
const Admin = require("../entities/Admin");

const secret = process.env.JWT_SECRET;

// 登入 API(僅測試用)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // 嘗試從三個身分找出使用者
  const roles = [
    { role: "USER", repo: AppDataSource.getRepository(User) },
    { role: "COACH", repo: AppDataSource.getRepository(Coach) },
    { role: "ADMIN", repo: AppDataSource.getRepository(Admin) },
  ];

  for (const { role, repo } of roles) {
    const user = await repo.findOneBy({ email, password });
    if (user) {
      const token = jwt.sign({ id: user.id, role }, secret, {
        expiresIn: "7d",
      });
      return res.json({ token });
    }
    return res.status(401).json({ message: "請先登入" });
  }
});

//回傳使用者資訊，方便前端判斷使用者登入狀態，調整右上角顯示狀態
router.get("/me", auth, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
