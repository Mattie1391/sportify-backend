const crypto = require("crypto");
const config = require("../config/index");
const { hashKey, hashIv } = config.get("ecpay");

// 產生綠界要求的CheckMacValue
function generateCMV(params) {
  // 排序參數（ASCII 升冪）
  const sorted = {};
  Object.keys(params)
    .sort()
    .forEach((key) => {
      sorted[key] = String(params[key]); // 確保參數值轉成字串
    });

  // 串接格式
  let raw = `HashKey=${hashKey}&`;
  raw += Object.entries(sorted)
    .map(([key, val]) => `${key}=${val}`)
    .join("&");
  raw += `&HashIV=${hashIv}`;

  // 按照綠界要求的規則編碼
  function encodeEcpayRaw(raw) {
    return encodeURIComponent(raw)
      .toLowerCase()
      .replace(/%20/g, "+") // 空白轉+號
      .replace(/%21/g, "!") // 驚嘆號不編碼
      .replace(/%28/g, "(") // 左括號不編碼
      .replace(/%29/g, ")") // 右括號不編碼
      .replace(/%2a/g, "*") // 星號不編碼
      .replace(/%2d/g, "-") // 減號不編碼
      .replace(/%2e/g, ".") // 點號不編碼
      .replace(/%5f/g, "_"); // 底線不編碼
  }
  raw = encodeEcpayRaw(raw);
  //SHA256加密 + 轉大寫
  const hash = crypto.createHash("sha256").update(raw).digest("hex").toUpperCase();
  return hash;
}

module.exports = {
  generateCMV,
};
