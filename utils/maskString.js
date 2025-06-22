//用來遮蔽字串，特別是uuid
function maskString(str, visibleCount = 5, maskChar = "*") {
  if (typeof str !== "string") return "";
  if (str.length <= visibleCount) return str; // 不足可見字數就原樣返回
  const visiblePart = str.slice(0, visibleCount);
  const maskedPart = maskChar.repeat(str.length - visibleCount);
  return visiblePart + maskedPart;
}

module.exports = maskString;
