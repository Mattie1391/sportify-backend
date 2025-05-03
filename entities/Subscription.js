const { EntitySchema } = require("typeorm");

// Subscription：紀錄使用者的訂閱紀錄與付款資訊
module.exports = new EntitySchema({
  name: "Subscription",
  tableName: "subscription",

  // === 欄位定義 ===
  columns: {
    // 訂閱 ID，主鍵
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
      nullable: false,
    },

    // 使用者 ID（誰買的訂閱）
    user_id: {
      type: "uuid",
      nullable: false,
    },

    // 訂閱購買時間
    purchased_at: {
      type: "timestamp",
      nullable: false,
    },

    // 訂單編號（外部金流系統回傳的 ID）
    order_number: {
      type: "varchar",
      length: 20,
      nullable: false,
    },

    // 訂閱方案名稱，使用 enum，可用字串代替（例如：'wellness方案'）
    plan: {
      type: "varchar",
      length: 30,
      nullable: false,
    },

    // 訂閱開始與結束時間
    start_at: {
      type: "timestamp",
      nullable: false,
    },
    end_at: {
      type: "timestamp",
      nullable: false,
    },

    // 付款方式（例如信用卡、Apple Pay）
    payment_method: {
      type: "varchar",
      length: 20,
      nullable: false,
    },

    // 發票圖檔網址
    invoice_image_url: {
      type: "varchar",
      length: 2048,
      nullable: false,
    },

    // 價格（台幣金額）
    price: {
      type: "int",
      nullable: false,
    },
  },

  // === 關聯定義 ===
  relations: {
    // 每筆訂閱紀錄屬於一位使用者
    User: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "user_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "fk_subscription_user_id",
      },
      onDelete: "CASCADE",
    },
    Subscription_Skill: {
      target: "Subscription_Skill",
      type: "one-to-many",
      inverseSide: "Subscription",
      joinColumn: {
        referencedColumnName: "id",
        foreignKeyConstraintName: "fk_subscription_skill_subscription_id",
      },
    },
  },
});
