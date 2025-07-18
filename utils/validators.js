const validator = require("validator");

//檢查值是否為 undefined
const isUndefined = (value) => {
  return typeof value === "undefined";
};

//檢查字串是否為無效的字串

const isNotValidString = (str) => {
  return typeof str !== "string" || str.trim() === "";
};

// 驗證整數
function isNotValidInteger(value) {
  return typeof value !== "number" || !Number.isInteger(value) || value <= 0;
}

// 驗證陣列
const isNotValidArray = (arr) => {
  return !Array.isArray(arr);
};

//驗證輸入年份月份
function isValidMonthFormat(str) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(str);
}

module.exports = {
  isUndefined,
  isNotValidString,
  isNotValidInteger,
  isNotValidArray,
  isNotValidUUID: (str) => !validator.isUUID(str),
  isNotValidEmail: (str) => !validator.isEmail(str),
  isNotValidUrl: (str) => !validator.isURL(str),
  isValidMonthFormat,
};
