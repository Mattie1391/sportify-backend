const jwt = require('jsonwebtoken')
const generateError = require('../utils/generateError');

const generateJWT = (payload)=> {
  // 產生 JWT token
  return jwt.sign(
      payload, // payload：Token 內存的資訊
      process.env.JWT_SECRET, // secret: 密鑰，存放於環境變數提高安全性
      { expiresIn: process.env.JWT_EXPIRES_DAY } //options：包含 expiresIn (效期)
  );
}
//解碼token
const verifyJWT = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (error, decoded) => {
      if (error) {
        reject(generateError(401, "請先登入"));
      } else {
        resolve(decoded); // 驗證成功：回傳token解碼後的payload資訊（id、role）
      }
    });
  });
}

module.exports = { 
  generateJWT,
  verifyJWT
};
