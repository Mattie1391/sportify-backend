// 格式化日期為 YYYY/MM/DD (箭頭函式寫法)
const formatDate = (date) => {
  if (!date) return null; // 如果 date 是 null 或 undefined，直接回傳 null

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份補零
  const day = String(date.getDate()).padStart(2, "0"); // 日期補零
  return `${year}/${month}/${day}`;
};

// 格式化日期為 YYYYMMDD 的箭頭函式
const formatYYYYMMDD = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

module.exports = { formatDate, formatYYYYMMDD };