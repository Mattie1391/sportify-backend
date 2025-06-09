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

// 將 YYYYMMDD 字串轉為 Date 物件
const parseYYYYMMDD = (str) => {
  if (!/^\d{8}$/.test(str)) return null;
  const year = parseInt(str.slice(0, 4), 10);
  const month = parseInt(str.slice(4, 6), 10) - 1;
  const day = parseInt(str.slice(6, 8), 10);
  return new Date(year, month, day);
};

// 將日期加上指定的天數，返回新的 Date 物件
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

//將UNIX時間轉化為+8時區
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const unixTot8zYYYYMMDD = (unixtime) => {
  const unix = unixtime;
  const result = dayjs.unix(unix).tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss.SSS");
  return result;
};

module.exports = { formatDate, formatYYYYMMDD, parseYYYYMMDD, addDays, unixTot8zYYYYMMDD };
