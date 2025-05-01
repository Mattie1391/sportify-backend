//檢查值是否為 undefined
const isUndefined = (value) => {
    console.log(value);
    return typeof value === 'undefined';
};
  
//檢查字串是否為無效的字串

const isNotValidString = (str) => {
    console.log(str);
    return typeof str !== 'string' || str.trim() === '';
};
  
module.exports = {
    isUndefined,
    isNotValidString,
};