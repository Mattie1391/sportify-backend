//統一驗證教練個人資料的格式(僅用在patch變更教練個資API)
const { isNotValidString, isNotValidUrl } = require("./validators");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

//傳入key:欄位名稱，value:欄位值
function validateField(key, value) {
  switch (key) {
    //驗證教練名稱(暱稱)，不可空白。
    case "nickname":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 50) return "長度不可超過50字";
      if (!/^[^\d\s]+$/.test(value)) return "不可包含空白或數字";
      return null;

    //驗證頭銜，允許空白
    case "job_title":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 12) return "總字數不可超過12字";
      if (value.includes(" ")) return "格式錯誤，中間不可有空格";
      return null;

    //驗證自我介紹，允許空白
    case "about_me":
      if (typeof value !== "string") return "請輸入字串格式";
      if (value.trim().length > 512) return "總字數不可超過512字";
      return null;

    //驗證身分必須的資料
    //驗證真實姓名
    case "realname":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 50) return "長度不可超過50字";
      return null;

    //驗證出生年月日格式
    case "birthday":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (typeof value !== "string" || !dayjs(value, "YYYY-MM-DD", true).isValid()) {
        return "生日格式錯誤";
      }
      if (dayjs().diff(value, "year") < 18) {
        return "您必須年滿 18 歲才能成為教練";
      }
      return null;

    //驗證身分證字號(暫時只限制長度及字串格式)
    case "id_number":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 20) return "身分證號格式錯誤";
      if (value.includes(" ")) return "格式錯誤，中間不可有空格";
      return null;

    //驗證手機號碼格式
    case "phone_number":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 30) return "電話號碼格式錯誤";
      return null;

    //驗證銀行代號
    case "bank_code":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 20) return "銀行代碼格式錯誤";
      if (value.includes(" ")) return "格式錯誤，中間不可有空格";
      return null;

    //驗證銀行帳號
    case "bank_account":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 20) return "銀行帳號格式錯誤";
      if (value.includes(" ")) return "格式錯誤，中間不可有空格";
      return null;

    //驗證存摺封面圖片網址
    case "bankbook_copy_url":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (isNotValidUrl(value)) return "圖片網址錯誤";
      if (value.trim().length > 2048) return "圖片網址字元數超出限制";
      return null;

    //驗證教練的專長介紹，必須是"單車騎乘技巧、耐力訓練、比賽策略"這樣用頓號區隔的樣子。
    case "skill_description":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 100) return "總字數不可超過100字";
      if (!/^[\u4e00-\u9fffA-Za-z0-9、]+$/.test(value))
        return "只能輸入中文、英文、數字，並請用頓號斷句";
      return null;

    //驗證專長，如瑜珈、足球。多項必須用"、"隔開。
    case "skill":
      if (isNotValidString(value)) return "請輸入字串格式，不可為空白";
      if (value.trim().length > 10) return "總字數不可超過10字";
      if (!/^[\u4e00-\u9fff、]+$/.test(value)) return "只能輸入中文並請用頓號斷句";
      return null;

    default:
      return null;
  }
}

module.exports = { validateField };
