const { EntitySchema } = require("typeorm");

// Skill 表：定義所有平台支援的技能（例如：瑜珈、有氧、重訓）
module.exports = new EntitySchema({
  name: "Skill",
  tableName: "skill",

  // === 欄位定義 ===
  columns: {
    // 技能 ID，主鍵，型別為 uuid，不能為 null
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },

    // 技能名稱，型別為 varchar(10)，不能為 null，範例包括「瑜珈」、「TRX」、「足球」
    name: {
      type: "varchar",
      length: 10,
      nullable: false,
      unique: true,
    },
    //運動屬於室內運動 or 室外運動
    activity_location_type: {
      type: "varchar",
      length: 10,
      nullable: false,
    },
  },

  relations: {
    CoachSkills: {
      target: "Coach_Skill",
      type: "one-to-many",
      inverseSide: "Skill",
    },
    Subscription_Skill: {
      target: "Subscription_Skill",
      type: "one-to-many",
      inverseSide: "Skill",
    },
    Course: {
      target: "Course",
      type: "one-to-many",
      inverseSide: "Skill",
    },
  },
});
