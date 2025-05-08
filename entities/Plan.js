const { EntitySchema } = require("typeorm");

//Plan表，儲存訂閱方案
module.exports = new EntitySchema({
  name: "Plan",
  tableName: "plan",

  // === 欄位定義 ===
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: true, // 自動遞增主鍵
    },
    plan_name: {
      type: "varchar",
      length: 20,
      nullable: false,
      unique: true,
    },
    plan_intro: {
      type: "varchar",
      length: 50,
      nullable: false,
    },
    pricing: {
      type: "int",
      nullable: false,
    },
    max_resolution: {
      type: "int", //提供給mux的是純數值720、1080、2160，2160轉成4K
      nullable: false,
    },
    livestream: {
      type: "boolean", //決定該訂閱方案可否看直播
      nullable: false,
    },
    sports_choice: {
      type: "int", //決定該方案可選的運動種類，1、3、null(eagerness，比對方案名稱)
      nullable: false,
    },
  },
});
