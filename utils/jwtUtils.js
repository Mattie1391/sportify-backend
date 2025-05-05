const jwt = require('jsonwebtoken')
const generateError = require('../utils/generateError');
const config = require('../config/index');

const generateJWT = (payload, secret, options) => {
  // 產生 JWT token
  return jwt.sign(
    payload, // payload：Token 內存的資訊
    secret || config.get("secret.jwtSecret"), // 如果未傳入 secret，則使用預設值
    options || { expiresIn: config.get("secret.jwtExpiresDay") } // 如果未傳入 options，則使用預設值
  );
};

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
