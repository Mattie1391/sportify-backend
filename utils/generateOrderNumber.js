// 使用箭頭函式產生新的訂單編號
// 傳入參數 tempOrderNumber 格式為 'YYYYMMDDXXXX'
// 其中前8碼為日期，後4碼為遞增數字

const generateOrderNumber = (tempOrderNumber) => {
  // 取出日期部分（前8碼）
  const datePart = tempOrderNumber.slice(0, 8);

  // 取出遞增數字部分（後4碼）
  const incrementPart = tempOrderNumber.slice(8);

  // 將遞增數字轉為整數後加一
  const newIncrement = parseInt(incrementPart, 10) + 1;

  // 將新的遞增數字補零至4位數
  const paddedIncrement = String(newIncrement).padStart(4, "0");

  // 組合新的訂單編號（日期 + 補零後的遞增數字）
  return `${datePart}${paddedIncrement}`;
};

module.exports = generateOrderNumber;