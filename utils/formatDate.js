// 格式化日期為 YYYY/MM/DD (箭頭函式寫法)
const formatDate = (date) => {
  const d = new Date(date);
  if (!(d instanceof Date) || isNaN(d)) return null; //擋掉 null / undefined / "2024-01-01"等字串格式

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0"); // 月份補零
  const day = String(d.getDate()).padStart(2, "0"); // 日期補零
  return `${year}/${month}/${day}`;
};

// 格式化日期為 YYYYMMDD 的箭頭函式
const formatYYYYMMDD = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;

module.exports = { formatDate, formatYYYYMMDD };
