const { EntitySchema } = require("typeorm");

// Coach（教練）資料表的 Entity 定義
module.exports = new EntitySchema({
  name: "Coach", // Entity 名稱，程式中會用 getRepository("Coach") 呼叫
  tableName: "coach", // 對應到資料庫中的實際資料表名稱

  // === 欄位定義 ===
  columns: {
    //以下為帳號註冊必須資料（除了忘記密碼）
    id: {
      primary: true, // 主鍵，每位教練唯一的識別碼
      type: "uuid",
      generated: "uuid", // 自動產生 UUID
    },
    email: {
      type: "varchar",
      length: 320,
      nullable: false,
      unique: true, // 電子郵件不可重複
    },
    password: {
      type: "varchar",
      length: 72,
      nullable: false, // 密碼
    },
    nickname: {
      type: "varchar",
      length: 10,
      nullable: false, // 前端顯示的暱稱
    },
    // 重設密碼的 token，僅儲存一組最新有效的 token，避免使用者在時限內多次請求產生好幾組有效的 token
    reset_password_token: {
      type: "varchar",
      length: 512,
      nullable: true,
    },

    //以下為個人頁面顯示資料
    profile_image_url: {
      type: "varchar",
      length: 2048,
      nullable: true, // 頭像圖片網址
    },
    background_image_url: {
      type: "varchar",
      length: 2048,
      nullable: true, // 頁面背景圖片網址
    },
    job_title: {
      type: "varchar",
      length: 12,
      nullable: true, // 頭銜，例如「資深健身教練」
    },
    about_me: {
      type: "varchar",
      length: 512,
      nullable: true, // 自我介紹，可空
    },
    hobby: {
      type: "varchar",
      length: 100,
      nullable: true, // 興趣愛好，可空
    },
    experience: {
      type: "varchar",
      length: 512,
      nullable: true, // 資歷自述，例如擁有國際皮拉提斯教學證照
    },
    favorite_words: {
      type: "varchar",
      length: 100,
      nullable: true, // 最喜歡的一句話，可空
    },
    motto: {
      type: "varchar",
      length: 100,
      nullable: true, // 座右銘，可空
    },

    //以下為驗證教練身分需要資料
    is_verified: {
      type: "boolean",
      default: false, // 是否已驗證教練身分，預設為 false
      nullable: true,
    },
    realname: {
      type: "varchar",
      length: 50,
      nullable: true, // 教練真實姓名，用於內部核對
    },
    id_number: {
      type: "varchar",
      length: 10,
      nullable: true, // 身分證號或居留證號碼
    },
    phone_number: {
      type: "varchar",
      length: 10,
      nullable: true, // 聯絡用手機號碼
    },
    birthday: {
      type: "date",
      nullable: true, // 出生日期，可空
    },
    license: {
      type: "varchar",
      length: 50,
      nullable: true, //證照名稱，可空。如UCI認證教練、CPR證書
    },
    // license_url: {
    //   type: "varchar",
    //   length: 2048,
    //   nullable: true, // 技能證照圖片網址，可空
    // },
    bank_code: {
      type: "varchar",
      length: 3,
      nullable: true, //銀行代碼，可空
    },
    bank_account: {
      type: "varchar",
      length: 20,
      nullable: true, //銀行帳號
    },
    bankbook_copy_url: {
      type: "varchar",
      length: 2048,
      nullable: true, // 存摺影本網址（薪資轉帳帳號）
    },
    skill_description: {
      type: "varchar",
      length: 100,
      nullable: true, // 教練擅長的技能簡介
    },
    experience_years: {
      type: "int",
      nullable: true, // 教學經驗年數
    },

    //建立&更新時間（自動建立）
    created_at: {
      type: "timestamp",
      createDate: true, // 自動生成建立時間
    },
    updated_at: {
      type: "timestamp",
      updateDate: true, // 每次更新會自動刷新這個欄位
    },
  },

  // === 關聯定義 ===
  relations: {
    // 一位教練可以擁有多個技能（透過 CoachSkill 中介表連結）
    Coach_Skill: {
      target: "Coach_Skill",
      type: "one-to-many", // 一對多關聯：一位教練對應多個技能連結
      inverseSide: "Coach", // 對方 entity（CoachSkill）中定義的關聯欄位名
    },
    // 一位教練可以有多筆轉帳記錄（薪水）
    PaymentTransfers: {
      target: "Payment_Transfer",
      type: "one-to-many", // 一對多關聯：一位教練對應多筆轉帳記錄
      inverseSide: "Coach", // 對方 entity（PaymentTransfer）中定義的關聯欄位名
    },

    // 一位教練可以收到多個學生評價
    Ratings: {
      target: "Rating",
      type: "one-to-many", // 一對多關聯：一位教練對應多個評價
      inverseSide: "Coach", // 對方 entity（Rating）中定義的關聯欄位名
    },
    // 一位教練可以開設多門課程
    Course: {
      target: "Course",
      type: "one-to-many", // 一對多關聯：一位教練對應多個課程
      inverseSide: "Coach", // 對方 entity（Course）中定義的關聯欄位名
    },
    // 一位教練可以有多個證照附件
    Coach_License: {
      target: "Coach_License",
      type: "one-to-many", // 一對多關聯：一位教練對應多個檔案
      inverseSide: "Coach", // 對方 entity（Course）中定義的關聯欄位名
    },
  },
});
