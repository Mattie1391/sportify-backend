//統一驗證教練個人資料的格式(僅用在patch變更教練個資API)
const {
  isNotValidString,
  isNotValidUrl,
  isNotValidInteger,
  isNotValidArray,
} = require("./validators");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

//傳入key:欄位名稱，value:欄位值
function validateField(key, value) {
  switch (key) {
    //驗證教練名稱(暱稱)，不可空白。
    case "nickname":
      if (isNotValidString(value)) return "教練名稱 請輸入字串格式，不可為空白";
      if (value.trim().length > 10 || value.trim().length < 2)
        return "教練名稱 請輸入至少2字至多10字";
      if (!/^[^\d\s]+$/.test(value)) return "教練名稱 不可包含數字";
      return null;

    //驗證頭銜，必填
    case "job_title":
      if (isNotValidString(value)) return "稱號 請輸入字串格式，不可為空白";
      if (value.trim().length > 12 || value.trim().length < 2) return "稱號 請輸入至少2字至多12字";
      if (value.includes(" ")) return "稱號 格式錯誤，中間不可有空格";
      return null;

    //驗證自我介紹，必填
    case "about_me":
      if (typeof value !== "string") return "自我介紹 請輸入字串格式";
      if (value.trim().length > 512 || value.trim().length < 10)
        return "自我介紹 總字數不可超過512字，或低於10字";
      return null;

    //驗證學經歷與得獎經歷，必填
    case "experience":
      if (typeof value !== "string") return "學經歷與得獎經歷 請輸入字串格式";
      if (value.trim().length > 512 || value.trim().length < 5)
        return "學經歷與得獎經歷 總字數不可超過512字，或低於5字";
      return null;

    //驗證感興趣的事物欄位
    case "hobby":
      if (typeof value !== "string") return "興趣 請輸入字串格式";
      if (value.trim().length > 100 || value.trim().length < 2)
        return "興趣 總字數不可超過100字，或少於2字";
      return null;

    //驗證座右銘。
    case "motto":
      if (typeof value !== "string") return "座右銘 請輸入字串格式";
      if (value.trim().length > 100 || value.trim().length < 2)
        return "座右銘 總字數不可超過100字，或少於2字";
      return null;

    //驗證最喜歡的一句話
    case "favorite_words":
      if (typeof value !== "string") return "最喜歡的一句話 請輸入字串格式";
      if (value.trim().length > 100 || value.trim().length < 2)
        return "最喜歡的一句話 總字數不可超過100字，或少於2字";
      return null;

    //驗證頭像圖片網址
    case "profile_image_url":
      if (isNotValidString(value)) return "profile_image_url 請輸入字串格式，不可為空白";
      if (isNotValidUrl(value)) return "profile_image_url 不是一個url";
      if (value.trim().length > 2048) return "profile_image_url 字元數超出限制";
      return null;

    //驗證背景圖片網址
    case "background_image_url":
      if (isNotValidString(value)) return "background_image_url 請輸入字串格式，不可為空白";
      if (isNotValidUrl(value)) return "background_image_url 不是一個url";
      if (value.trim().length > 2048) return "background_image_url 字元數超出限制";
      return null;

    //驗證身分必須的資料
    //驗證真實姓名
    case "realname":
      if (isNotValidString(value)) return "真實姓名 請輸入字串格式，不可為空白";
      if (value.trim().length > 10 || value.trim().length < 2)
        return "真實姓名 長度不可超過10字或低於2字";
      return null;

    //驗證出生年月日格式
    case "birthday":
      if (isNotValidString(value)) return "出生年月日 請輸入字串格式，不可為空白";
      if (typeof value !== "string" || !dayjs(value, "YYYY-MM-DD", true).isValid()) {
        return "生日格式錯誤";
      }
      if (dayjs().diff(value, "year") < 18) {
        return "出生年月日 您必須年滿 18 歲才能成為教練";
      }
      return null;

    //驗證身分證字號(暫時只限制長度及字串格式)
    case "id_number":
      if (isNotValidString(value)) return "身份證字號 請輸入字串格式，不可為空白";
      if (!/^[A-Z][0-9]{9}$/.test(value)) return "身份證字號 格式錯誤";
      return null;

    //驗證手機號碼格式
    case "phone_number":
      if (isNotValidString(value)) return "手機號碼 請輸入字串格式，不可為空白";
      if (value.trim().length !== 10) return "手機號碼 格式錯誤";
      return null;

    //驗證銀行代號
    case "bank_code":
      if (isNotValidString(value)) return "銀行代號 請輸入字串格式，不可為空白";
      if (value.trim().length !== 3) return "銀行代號 格式錯誤";
      if (value.includes(" ")) return "銀行代號 格式錯誤，中間不可有空格";
      return null;

    //驗證銀行帳號
    case "bank_account":
      if (isNotValidString(value)) return "銀行帳號 請輸入字串格式，不可為空白";
      if (value.trim().length > 20 || value.trim().length < 10) return "銀行帳號 格式錯誤";
      if (!/^\d+$/.test(value)) return "銀行帳號 格式錯誤，不可有特殊字元或空白";
      return null;

    //驗證存摺封面圖片網址
    case "bankbook_copy_url":
      if (isNotValidString(value)) return "存摺封面url 不可為空白";
      if (isNotValidUrl(value)) return "存摺封面url 不是一個url";
      if (value.trim().length > 2048) return "存摺封面url 字元數超出限制";
      return null;

    //驗證教練的專長介紹，必須是"單車騎乘技巧、耐力訓練、比賽策略"這樣用頓號區隔的樣子。
    case "skill_description":
      if (isNotValidString(value)) return "專長介紹 請輸入字串格式，不可為空白";
      if (value.trim().length > 100 || value.trim().length < 10)
        return "專長介紹 總字數不可超過100字，或少於10字";
      if (!/^[\u4e00-\u9fffA-Za-z0-9、]+$/.test(value))
        return "專長介紹 只能輸入中文、英文、數字，並請用頓號斷句";
      return null;

    //驗證專長，如瑜珈、足球。多項必須用"、"隔開。
    case "skill":
      if (isNotValidString(value)) return "專長類別 請輸入字串格式，不可為空白";
      if (value.trim().length > 10 || value.trim().length < 2)
        return "專長類別 總字數不可超過10字，或少於2字";
      if (!/^[\u4e00-\u9fff、]+$/.test(value)) return "專長類別 只能輸入中文並請用頓號斷句";
      return null;

    //驗證經驗年數
    case "experience_years":
      if (isNotValidInteger(value)) return "教學經驗 請輸入數字，不可為0或小數";
      return null;

    //驗證證照與資格名稱。多項必須用"、"隔開。
    case "license":
      if (isNotValidString(value)) return "證照名稱 請輸入字串格式，不可為空白";
      if (value.trim().length > 50 || value.trim().length < 5)
        return "證照名稱 總字數不可超過50字，或少於5字";
      if (!/^[\u4e00-\u9fffA-Za-z0-9、 ]+$/.test(value))
        return "證照名稱 只能輸入中文、英文、數字，並請用頓號斷句"; //允許中間有空格
      return null;

    //驗證證照與資格上傳url
    case "license_data":
      if (isNotValidArray(value)) return "證照url 格式必須是陣列";
      return null;

    default:
      return null;
  }
}

module.exports = { validateField };
