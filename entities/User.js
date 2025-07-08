const { EntitySchema } = require("typeorm");

// User（學員）資料表的 Entity 定義
module.exports = new EntitySchema({
  name: "User", // Entity 名稱，用於程式中操作資料庫
  tableName: "user", // 對應資料庫的實際資料表名稱

  // === 欄位定義 ===
  columns: {
    // 使用者 ID，主鍵，唯一識別每位使用者
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid", // 自動產生 UUID
    },

    // 使用者名稱（顯示用）
    name: {
      type: "varchar",
      length: 50,
      nullable: false,
    },

    // 使用者 email，需唯一，用於登入
    email: {
      type: "varchar",
      length: 320,
      nullable: false,
      unique: true,
    },
    // Google ID
    google_id: {
      type: "varchar",
      length: 50,
      nullable: true,
      unique: true, // 若有使用 Google 登入，則此欄位會有值
    },
    // 密碼
    password: {
      type: "varchar",
      length: 72,
      nullable: true,
    },

    // 是否已驗證
    is_verified: {
      type: "boolean",
      default: false, // 預設為未驗證
    },

    // 重設密碼的 token，僅儲存一組最新有效的 token，避免使用者在時限內多次請求產生好幾組有效的 token
    reset_password_token: {
      type: "varchar",
      length: 512,
      nullable: true,
    },

    // 訂閱方案 ID（若有訂閱才會有值）
    subscription_id: {
      type: "uuid",
      nullable: true,
    },

    // 頭像圖片網址
    profile_image_url: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },

    // 頭像圖片在cloudinary的public_id
    profile_image_public_id: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },

    // 資料建立時間（自動填入）
    created_at: {
      type: "timestamp",
      createDate: true,
    },

    // 資料更新時間（每次更新自動變動）
    updated_at: {
      type: "timestamp",
      updateDate: true,
    },
  },

  // === 關聯定義 ===
  relations: {
    Subscription: {
      target: "Subscription",
      type: "one-to-many",
      inverseSide: "User", // 對應 Subscription 裡的 User 關聯
    },

    // ➤ 使用者收藏的課程（User → UserCourseFavorite 一對多）
    User_Course_Favorite: {
      target: "User_Course_Favorite", // 關聯到中介表
      type: "one-to-many",
      inverseSide: "User", // 對方 entity 裡的欄位名
    },
  },
});
