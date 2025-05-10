// 格式化日期為 YYYY/MM/DD (箭頭函式寫法)
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份需要補零
    const day = String(date.getDate()).padStart(2, "0"); // 日期需要補零
    return `${year}/${month}/${day}`;
  };

  module.exports = formatDate;