const bcrypt = require("bcrypt");
const { isUndefined, isNotValidString } = require("../utils/validators");
const generateError = require("../utils/generateError");
const AppDataSource = require("../db/data-source");
const { generateJWT } = require("../utils/jwtUtils");
const config = require("../config/index");
const secret = config.get("secret.jwtSecret");
const expiresDay = config.get("secret.jwtExpiresDay");
const User = require("../entities/User");
const Coach = require("../entities/Coach");
const Admin = require("../entities/Admin");

async function postSignup(req, res, next) {
  try {
    const { name, nickname, email, password, password_check } = req.body;
    // 判斷路徑來決定角色
    const role = req.path.includes("/coaches")
      ? "COACH"
      : req.path.includes("/users")
      ? "USER"
      : null;
    // 密碼規則：至少8個字元，最多16個字元，至少一個數字，一個小寫字母和一個大寫字母
    const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;

    // 判斷角色來決定顯示名稱
    // 如果是 USER，則使用 name；如果是 COACH，則使用 nickname
    const displayName = role === "USER" ? name : nickname;
    if (
      isUndefined(displayName) ||
      isNotValidString(displayName) ||
      isUndefined(email) ||
      isNotValidString(email) ||
      isUndefined(password) ||
      isNotValidString(password)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }

    if (!passwordPattern.test(password)) {
      return next(
        generateError(
          400,
          "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字"
        )
      );
    }

    if (password !== password_check) {
      return next(generateError(400, "密碼確認錯誤"));
    }

    // 判斷角色來決定資料庫
    // 如果是 USER，則使用 User 資料庫；如果是 COACH，則使用 Coach 資料庫
    const repository = AppDataSource.getRepository(
      role === "USER" ? User : Coach
    );
    // 從資料庫中根據 email 查詢使用者
    const existingUser = await repository.findOne({ where: { email } });

    if (existingUser) {
      return next(generateError(409, "Email 已被使用"));
    }

    // 密碼加密
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // 建立新使用者
    // 如果是 USER，則使用 name；如果是 COACH，則使用 nickname
    const newUser = repository.create({
      name: role === "USER" ? displayName : undefined,
      nickname: role === "COACH" ? displayName : undefined,
      email,
      password: hashPassword,
      role,
    });

    await repository.save(newUser);
    res.status(201).json({
      status: true,
      message: "註冊成功",
      data: {
        ...(role === "USER"
          ? { user: { id: newUser.id, name: newUser.name } }
          : { coach: { id: newUser.id, nickname: newUser.nickname } }),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (
      isUndefined(email) ||
      isNotValidString(email) ||
      isUndefined(password) ||
      isNotValidString(password)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }

    // 嘗試從三個身分找出使用者
    const roles = [
      { role: "USER", repo: AppDataSource.getRepository(User) },
      { role: "COACH", repo: AppDataSource.getRepository(Coach) },
      { role: "ADMIN", repo: AppDataSource.getRepository(Admin) },
    ];

    for (const { role, repo } of roles) {
      const user = await repo.findOneBy({ email });
      if (user) {
        //檢查密碼 (使用 bcrypt.compare比對加密後的密碼)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return next(generateError(400, "使用者不存在或密碼輸入錯誤"));
        }
        //密碼正確，產生 JWT
        const token = await generateJWT({ id: user.id, role }, secret, {
          expiresIn: expiresDay,
        });
        return res.json({ token });
      }
    }
    // 如果沒有找到使用者，則返回錯誤
    return next(generateError(400, "使用者不存在或密碼輸入錯誤"));
  } catch (error) {
    next(error);
  }
}

//回傳使用者資訊，方便前端判斷使用者登入狀態，調整右上角顯示狀態
async function getMe(req, res, next) {
  res.json(req.user);
}

module.exports = {
  postSignup,
  postLogin,
  getMe,
};
