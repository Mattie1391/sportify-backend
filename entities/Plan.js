const { EntitySchema } = require("typeorm");

// Plan 表，儲存訂閱方案
module.exports = new EntitySchema({
  name: "Plan",
  tableName: "plan",

  // === 欄位定義 ===
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid", // 自動遞增主鍵
    },
    name: {
      type: "varchar",
      length: 20,
      nullable: false,
      unique: true,
    },
    intro: {
      type: "varchar",
      length: 50,
      nullable: false,
    },
    pricing: {
      type: "int",
      nullable: false,
    },
    max_resolution: {
      type: "int", // 提供給 mux 的是純數值 720、1080、2160，2160 轉成 4K
      nullable: false,
    },
    livestream: {
      type: "boolean", // 決定該訂閱方案可否看直播
      nullable: false,
    },
    sports_choice: {
      type: "int", // 決定該方案可選的運動種類，1、3、0 (eagerness，要比對方案名稱)
      nullable: false,
    },
  },

  // === 關聯定義 ===
  relations: {
    Subscriptions: {
      target: "Subscription",
      type: "one-to-many",
      inverseSide: "Plan",
    },
  },
});
