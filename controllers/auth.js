const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { isUndefined, isNotValidString, isNotValidEmail } = require("../utils/validators");
const generateError = require("../utils/generateError");
const AppDataSource = require("../db/data-source");
const { generateJWT, verifyJWT } = require("../utils/jwtUtils");
const config = require("../config/index");
const secret = config.get("secret.jwtSecret");
const expiresDay = config.get("secret.jwtExpiresDay");
const temporaryExpiresDay = config.get("secret.jwtTemporaryExpiresDay");
const User = require("../entities/User");
const Coach = require("../entities/Coach");
const Admin = require("../entities/Admin");
const gmailUserName = config.get("email.gmailUserName");
const gmailAppPassword = config.get("email.gmailAppPassword");
const { findRoleAndRepoByEmail, findRepoByRole } = require("../services/roleServices");

//使用者/教練註冊
async function postSignup(req, res, next) {
  try {
    const { name, nickname, email, password, password_check } = req.body;
    // 判斷路徑來決定角色
    const role = req.path.includes("/coaches")
      ? "COACH"
      : req.path.includes("/users")
      ? "USER"
      : null;
    // 密碼規則：至少8個字元，最多16個字元，至少一個數字，一個小寫字母和一個大寫字母，不允許空白字元
    const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[^\s]{8,16}$/;

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
          "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字，不允許空白字元"
        )
      );
    }

    if (password !== password_check) {
      return next(generateError(400, "密碼確認錯誤"));
    }

    // 判斷角色來決定資料庫
    const repo = await findRepoByRole(role);

    // 從資料庫中根據 email 查詢使用者
    const user = await repo.findOne({ where: { email } });

    if (user) {
      return next(generateError(409, "Email 已被使用"));
    }

    // 密碼加密
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // 建立新使用者
    // 如果是 USER，則使用 name；如果是 COACH，則使用 nickname
    const newUser = repo.create({
      name: role === "USER" ? displayName : undefined,
      nickname: role === "COACH" ? displayName : undefined,
      email,
      password: hashPassword,
      role,
    });

    await repo.save(newUser);
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
//管理員註冊
async function postAdminSignup(req, res, next) {
  try {
    const { email, password, password_check } = req.body;
    // 判斷路徑來決定角色
    const role = "ADMIN";

    // 密碼規則：至少8個字元，最多16個字元，至少一個數字，一個小寫字母和一個大寫字母，不允許空白字元
    const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[^\s]{8,16}$/;

    if (
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
          "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字，不允許空白字元"
        )
      );
    }

    if (password !== password_check) {
      return next(generateError(400, "密碼確認錯誤"));
    }

    // 判斷角色來決定資料庫
    const repo = await AppDataSource.getRepository(Admin);

    // 從資料庫中根據 email 查詢使用者
    const admin = await repo.findOne({ where: { email } });

    if (admin) {
      return next(generateError(409, "Email 已被使用"));
    }

    // 密碼加密
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // 建立新使用者
    const newAdmin = repo.create({
      email,
      password: hashPassword,
      role,
    });

    await repo.save(newAdmin);
    res.status(201).json({
      status: true,
      message: "註冊成功",
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
      },
    });
  } catch (error) {
    next(error);
  }
}
//登入
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

    // 從email中找出對應的角色和資料庫
    const result = await findRoleAndRepoByEmail(email);

    if (!result) {
      return next(generateError(400, "查無此信箱"));
    }
    const { role, repo } = result;

    // 從資料庫中找出對應的使用者
    const user = await repo.findOne({ where: { email } });

    // 如果沒有找到使用者，返回錯誤
    if (!user) {
      return next(generateError(400, "查無此信箱"));
    }

    // 檢查密碼 (使用 bcrypt.compare比對加密後的密碼)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(generateError(400, "使用者不存在或密碼輸入錯誤"));
    }
    // 密碼正確，產生 JWT
    const token = await generateJWT({ id: user.id, role }, secret, {
      expiresIn: expiresDay,
    });

    return res.json({ token });
  } catch (error) {
    next(error);
  }
}
//忘記密碼
async function postForgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    // 檢查請求資料是否完整
    if (isNotValidEmail(email)) {
      return next(generateError(400, "email格式錯誤"));
    }

    // 從email中找出對應的角色和資料庫
    const { role, repo } = await findRoleAndRepoByEmail(email);

    // 從資料庫中找出對應的使用者
    user = await repo.findOne({ where: { email } });

    // 如果沒有找到使用者，返回錯誤
    if (!user) {
      return next(generateError(400, "查無此信箱"));
    }

    // 生成臨時的 JWT Token，包含用戶 ID 和角色
    const temporaryToken = await generateJWT(
      { id: user.id, role: role }, // 傳入用戶 ID 和角色
      secret, // 簽名密鑰
      { expiresIn: temporaryExpiresDay } // 設定有效期 一小時
    );

    // 創建郵件傳輸器
    const transporter = nodemailer.createTransport({
      service: "gmail", // 使用 Gmail 作為電子郵件服務
      auth: {
        user: gmailUserName, // 發送郵件的 Gmail 帳號
        pass: gmailAppPassword, // 從環境變數讀取應用程式專用密碼
      },
    });

    // 動態生成的重設密碼連結
    // TODO 確認前端串接網址
    const resetLink = `https://tteddhuang.github.io/sportify-plus/api/v1/auth/reset-password?token=${temporaryToken}`;

    // 定義要發送的郵件內容
    const mailOptions = {
      from: "Sportify Plus <sportifyplus2025@gmail.com>", // 寄件者名稱和電子郵件
      to: email, // 收件者的電子郵件地址
      subject: "Sportify+重設密碼郵件", // 郵件主旨
      text: `請點選以下連結重設您的密碼(一小時內有效)：\n${resetLink}`, // 純文字內容
      html: `<p>請點選以下連結重設您的密碼(一小時內有效)：</p><a href="${resetLink}">${resetLink}</a>`, // HTML 格式內容
    };

    // 發送郵件
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        // 如果發送失敗，回傳 HTTP 錯誤
        return next(generateError(500, "無法發送電子郵件，請稍後再試"));
      }
    });

    // 更新使用者的重設密碼 Token
    user.reset_password_token = temporaryToken; // 儲存 Token
    await repo.save(user); // 更新資料庫

    // 返回成功訊息
    res.status(200).json({
      status: true, // 狀態為成功
      message: "已發送重設密碼信件至您的信箱", // 成功訊息
    });
  } catch (error) {
    // 捕獲錯誤並傳遞給下一個錯誤處理器
    next(error);
  }
}
//重設密碼
async function patchResetPassword(req, res, next) {
  try {
    const { new_password, password_check } = req.body;
    const token = req.query.token; // 從 URL 的 Query Parameters 中取得 Token

    // 檢查請求資料是否完整
    if (!token || !new_password || !password_check) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    // 驗證 Token 並解碼
    const decoded = await verifyJWT(token, secret);
    if (!decoded) {
      return next(generateError(400, "Token 無效或已過期"));
    }

    // 檢查密碼是否符合規則
    const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;
    if (!passwordPattern.test(new_password)) {
      return next(
        generateError(400, "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字")
      );
    }

    if (new_password !== password_check) {
      return next(generateError(400, "密碼確認錯誤"));
    }

    const { id, role } = decoded;

    // 根據角色找到對應的用戶
    const repo = await findRepoByRole(role);

    // 從資料庫中找出對應的使用者
    const user = await repo.findOne({ where: { id } });

    if (!user) {
      return next(generateError(400, "找不到用戶"));
    }

    // 檢查 Token 是否為最新的
    if (user.reset_password_token !== token) {
      //從資料庫中取得的 token 比對 url中的 token
      return next(generateError(400, "Token 不正確或已過期"));
    }

    // 密碼加密
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(new_password, salt);

    // 更新用戶密碼
    user.password = hashPassword;
    await repo.save(user);

    res.status(200).json({
      status: true,
      message: "密碼重設成功",
    });
  } catch (error) {
    next(error);
  }
}
//驗證登入（回傳使用者資訊）
async function getMe(req, res, next) {
  res.status(200).json({
    status: true,
    message: "成功取得資料",
    data: req.user,
  });
}

module.exports = {
  postSignup,
  postAdminSignup,
  postLogin,
  getMe,
  postForgotPassword,
  patchResetPassword,
};
