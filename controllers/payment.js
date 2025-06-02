const dayjs = require("dayjs");
const logger = require("../config/logger");
const config = require("../config/index");
const { merchantId, returnUrl, notifyUrl } = config.get("ecpay"); //引入綠界金流參數
const { generateCMV } = require("../services/ecPayServices");
const generateError = require("../utils/generateError");
const generateOrderNumber = require("../utils/generateOrderNumber"); // 引入生成訂單編號的工具函數
const AppDataSource = require("../db/data-source");
const subscriptionRepo = AppDataSource.getRepository("Subscription");

//新增付款
async function postCreatePayment(req, res, next) {
  try {
    const { price, order_number, plan_name } = req.body; //前端需回傳price，order_number，plan_name
    if (!order_number) return next(generateError(400, "缺少訂單編號"));
    const subscription = await subscriptionRepo.findOneBy({ order_number: order_number });
    if (!subscription) return next(generateError(404, "查無訂單"));
    if (subscription.is_paid) return next(generateError(400, "此訂單已付款"));
    if (!price) return next(generateError(400, "缺少訂單金額"));
    if (!plan_name) return next(generateError(400, "缺少訂閱方案名稱"));

    // 設定金流特店訂單編號，非訂閱紀錄的訂單編號
    // 如ORD9c6ca7aa19bd401d，綠界要求特店訂單編號不可重複，英數字大小寫混合
    const uuid16 = require("uuid").v4().replace(/-/g, "").slice(0, 16); //取uuid前16位並移除dash
    const merchantTradeNo = `ORD${uuid16}`;
    // 將 merchantTradeNo 寫入當前訂閱紀錄
    subscription.merchant_trade_no = merchantTradeNo;
    await subscriptionRepo.save(subscription);
    //設定要回傳的資料
    const postdata = {
      MerchantID: merchantId, //特店編號
      MerchantTradeNo: merchantTradeNo, //特店訂單編號均為唯一值，不可重複使用。英數字大小寫混合
      MerchantTradeDate: dayjs().format("YYYY/MM/DD HH:mm:ss"), //格式為：yyyy/MM/dd HH:mm:ss
      PaymentType: "aio", //交易類型，固定回傳aio
      TotalAmount: price, //交易金額
      TradeDesc: "sportify會員訂閱", //交易描述
      ItemName: plan_name, //商品名稱
      ChoosePayment: "Credit", //選擇預設付款方式，信用卡
      EncryptType: 1, //CheckMacValue加密類型，固定回傳1，代表SHA256
      PeriodAmount: price, //每次授權金額
      PeriodType: "M", //週期種類，月週期
      Frequency: 1, //執行頻率，最多1-12次
      ExecTimes: 12, //執行次數，範圍為2-99次
      BindingCard: 1, //是否綁定信用卡，1=是
      MerchantMemberID: `${merchantId}+sportify123`,
      ReturnURL: notifyUrl, //第一次定期定額授權成功，扣款資訊回傳網址
      PeriodReturnURL: notifyUrl, //第二次開始的定期定額扣款資訊回傳網址
      ClientBackURL: returnUrl, //付款完成導回此網址
    };
    //在物件內新增CheckMacValue檢查碼欄位
    postdata.CheckMacValue = generateCMV(postdata);
    //整理成html form回傳格式
    const formInputs = Object.entries(postdata)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join("\n");
    //回傳html form
    const form = `
    <form id="ecpay-form" method="post" action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5">
    ${formInputs}
    </form>
    <script>document.getElementById('ecpay-form').submit();</script>
    `;
    res.send(form);
  } catch (error) {
    next(error);
  }
}

//取消定期扣款
async function postCancelPayment(req, res, next) {
  try {
    const { merchant_trade_no } = req.body; //前端需回傳merchant_trade_no
    if (!merchant_trade_no) return next(generateError(400, "缺少綠界金流特店訂單編號"));
    const subscription = await subscriptionRepo.findOneBy({ merchant_trade_no: merchant_trade_no });
    if (!subscription) return next(generateError(404, "查無訂單"));

    const postdata = {
      MerchantID: merchantId,
      MerchantTradeNo: merchant_trade_no,
      Action: "Cancel",
      TimeStamp: dayjs().unix(), // 確保每次發送時為最新時間
    };
    //在物件內新增CheckMacValue檢查碼欄位
    postdata.CheckMacValue = generateCMV(postdata);
    //整理成html form回傳格式
    const formInputs = Object.entries(postdata)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join("\n");
    const form = `
  <form id="cancel-form" method="post" action="https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction">
  ${formInputs}
  </form>
  <script>document.getElementById('cancel-form').submit();</script>
  `;
    res.send(form);
  } catch (error) {
    next(error);
  }
}

//webhook通知付款結果
async function postPaymentConfirm(req, res, next) {
  try {
    const { CheckMacValue, ...data } = req.body; //把CMV欄位單獨取出
    //驗證 CheckMacValue 是否正確
    const localCMV = generateCMV(data);
    if (localCMV !== CheckMacValue) {
      return next(
        generateError(400, "通知驗證失敗：CheckMacValue 驗證不符，資料可能被修改或參數異常")
      );
    }
    //若付款失敗，data.RtnCode !== "1"
    if (data.RtnCode !== "1") return next(generateError(400, `付款失敗：${data.RtnMsg}`)); //RtnMsg綠界回傳錯誤訊息
    const merchant_trade_no = data.MerchantTradeNo; //取得綠界金流特店訂單編號
    //查找此筆定期定額扣款最新訂單紀錄
    const latestSub = await subscriptionRepo.findOne({
      where: {
        merchant_trade_no: merchant_trade_no,
      },
      order: {
        purchased_at: "DESC",
      },
    });
    if (!latestSub) return next(generateError(404, "查無相關定期定額訂單"));
    if (Number(data.TradeAmt) !== latestSub.price) {
      logger.warn(`[Webhook] 訂單金額不一致：實付 ${data.TradeAmt} ≠ 訂單 ${latestSub.price}`);
      return next(generateError(400, "訂單金額與實際付款金額不一致，請聯絡綠界金流客服確認"));
    }
    //取得付款日期
    const paymentDate = dayjs(data.PaymentDate, "YYYY/MM/DD HH:mm:ss");

    //若為第一次定期定額扣款，更新訂單紀錄
    if (data.TotalSuccessTimes === 1) {
      latestSub.payment_method =
        data.PaymentType === "Credit_CreditCard" ? "信用卡" : data.PaymentType; //付款方式
      latestSub.purchased_at = paymentDate.toDate(); //付款時間
      latestSub.start_at = paymentDate.toDate(); //訂閱開始時間
      // 訂閱結束時間為下一個月的同一天（若無該天自動退到月底）
      latestSub.end_at = paymentDate.add(1, "month").toDate(); //訂閱結束時間
      latestSub.is_paid = true; //付款狀態，紀錄為已付款
      latestSub.invoice_image_url = null; //TODO:發票功能待確認
      latestSub.is_renewal = true; //預設自動續訂
      const newSub = await subscriptionRepo.save(latestSub); //更新資料庫
      if (!newSub) {
        return next(generateError(500, "更新資料失敗"));
      }
    } else {
      //若非第一次定期定額扣款，創建新的訂單紀錄
      //確認webhook沒有重複打入，避免重複創建新訂閱紀錄
      const exist = await subscriptionRepo.findOne({
        where: {
          merchant_trade_no: latestSub.merchant_trade_no,
          purchased_at: paymentDate.toDate(),
        },
      });
      if (exist) return res.send("1|OK");
      if (!latestSub.is_renewal) {
        logger.warn(`[Webhook] 收到非續訂狀態的扣款：訂單 ${latestSub.order_number}`);
      }
      //撈出資料庫今日最新訂單，並創建
      const todayStr = paymentDate.format("YYYYMMDD");
      const todayMaxOrder = await subscriptionRepo.findOne({
        where: { order_number: Like(`${todayStr}%`) }, // 前 8 碼為今天日期
        order: { order_number: "DESC" }, // 照字串遞減排序（越大的越前面）
        take: 1, // 只取最新的一筆
      });
      const startingOrderNumber = todayMaxOrder?.order_number || todayStr + "0000";
      const orderNumber = generateOrderNumber(startingOrderNumber);
      //創建新訂單前，先停用舊訂單的續訂
      await subscriptionRepo.update(
        {
          user_id: latestSub.user_id,
          is_renewal: true,
        },
        {
          is_renewal: false, // 停用未關閉的續訂
        }
      );
      //創建新訂單前，先停止未到期的訂單有效期（預防兩個有效訂閱同時存在）
      await subscriptionRepo.update(
        {
          user_id: latestSub.user_id,
          end_at: MoreThan(paymentDate.toDate()), // 停用未到期的訂單
        },
        {
          end_at: paymentDate.toDate(), // 停用未關閉的續訂
        }
      );
      const newSub = subscriptionRepo.create({
        user_id: latestSub.user_id,
        plan_id: latestSub.plan_id,
        order_number: orderNumber,
        price: data.TradeAmt, //訂單金額
        is_paid: true, //付款狀態，紀錄為已付款
        merchant_trade_no: merchant_trade_no, //定期定額扣款都是用同一組綠界編號
        purchased_at: paymentDate.toDate(), //付款時間
        start_at: paymentDate.toDate(), //訂閱開始時間
        end_at: paymentDate.add(1, "month").toDate(), //訂閱結束時間
        payment_method: data.PaymentType === "Credit_CreditCard" ? "信用卡" : data.PaymentType, //付款方式
        invoice_image_url: null, //TODO:發票功能待確認
        is_renewal: true, //預設自動續訂
      });
      const savedSub = await subscriptionRepo.save(newSub);
      if (!savedSub) {
        return next(generateError(500, "資料儲存失敗"));
      }
    }
    return res.send("1|OK"); //綠界要求回傳此格式，表示成功接收
  } catch (error) {
    next(error);
  }
}

//接收取消結果的通知（從前端導回通知並再次檢查）
async function postCancelConfirm(req, res, next) {
  try {
    const { CheckMacValue, ...data } = req.body; //把CMV欄位單獨取出
    //驗證 CheckMacValue 是否正確
    const localCMV = generateCMV(data);
    if (localCMV !== CheckMacValue) {
      return next(generateError(400, "驗證失敗：CheckMacValue 驗證不符，資料可能被修改或參數異常"));
    }
    //查找對應訂單紀錄
    const merchant_trade_no = data.MerchantTradeNo; //取得綠界金流特店訂單編號
    const subscription = await subscriptionRepo.findOneBy({
      merchant_trade_no: merchant_trade_no,
    });
    if (!subscription) return next(generateError(404, "查無訂單"));

    //若是取消定期定額扣款狀態通知
    if (data.RtnCode === "1") {
      subscription.is_renewal = false; //取消自動續訂
      await subscriptionRepo.save(subscription); //更新資料庫
    } else {
      return next(generateError(400, `取消定期定額扣款失敗：${data.RtnMsg}`)); //RtnMsg綠界回傳錯誤訊息
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postCreatePayment,
  postCancelPayment,
  postPaymentConfirm,
  postCancelConfirm,
};
