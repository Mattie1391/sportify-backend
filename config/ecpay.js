module.exports = {
  merchantId: process.env.MERCHANT_ID, //特店編號
  hashKey: process.env.HASH_KEY, //串接金鑰HashKey
  hashIv: process.env.HASH_IV, //串接金鑰HashIV
  returnUrl: process.env.RETURN_URL, //付款完成導回該網址
  notifyUrl: process.env.NOTIFY_URL, //付款狀態通知網址
};
