//統一驗證教練個人資料的格式(僅用在patch變更教練個資API)
const { isNotValidString } = require("./validators");

function validateField(key, value) {
  switch (key) {
    case "nickname":
      if (value.trim().length === 0) return "不可為空白";
      if (isNotValidString(value)) return "必須是文字";
      if (value.trim().length > 50) return "長度不可超過50字";
      if (!/^[^\d\s]+$/.test(value)) return "不可包含空白";
    default:
      return null;
  }
}

module.exports = { validateField };
