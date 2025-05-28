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
    //訂閱方案ID
    plan_id: {
      type: "uuid",
      nullable: false,
    },
    // 訂單編號
    order_number: {
      type: "varchar",
      length: 20,
      nullable: false,
      unique: true, // 確保訂單編號唯一
    },
    // 價格（台幣金額）
    price: {
      type: "int",
      nullable: false,
    },
    // 付款狀態(未付款/已付款)
    is_paid: {
      type: "boolean",
      nullable: false,
      default: false,
    },
    // 建立訂單時間
    created_at: {
      type: "timestamp",
      createDate: true,
    },
    // 更新訂單時間
    updated_at: {
      type: "timestamp",
      updateDate: true,
    },

    // 付款後才會新增以下欄位

    // 綠界金流特店訂單編號
    merchant_trade_no: {
      type: "varchar",
      length: 20,
      nullable: true,
    },
    // 付款時間
    purchased_at: {
      type: "timestamp",
      nullable: true,
    },
    // 訂閱開始與結束時間
    start_at: {
      type: "timestamp",
      nullable: true,
    },
    end_at: {
      type: "timestamp",
      nullable: true,
    },
    // 付款方式（如信用卡）
    payment_method: {
      type: "varchar",
      length: 20,
      nullable: true,
    },
    // 發票圖檔網址
    invoice_image_url: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },
    // 是否自動續訂方案
    is_renewal: {
      type: "boolean",
      nullable: false,
      default: false, // 預設為尚未訂閱
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
    Plan: {
      target: "Plan",
      type: "many-to-one",
      joinColumn: {
        name: "plan_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "fk_subscription_plan_id",
      },
      nullable: false,
    },
    Subscription_Skills: {
      target: "Subscription_Skill",
      type: "one-to-many",
      inverseSide: "Subscription",
    },
  },
});
