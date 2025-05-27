// 禁止前端亂輸入參數，如 banana=999
function checkValidQuerys(querys, validQuerys) {
  const queryKeys = Object.keys(querys);
  const invalidQuerys = queryKeys.filter((key) => !validQuerys.includes(key));
  return invalidQuerys;
}

module.exports = {
  checkValidQuerys,
};
