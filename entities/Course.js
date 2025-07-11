const { EntitySchema } = require("typeorm");

// 課程表：儲存平台上所有課程的基本資訊
module.exports = new EntitySchema({
  name: "Course", // Entity 名稱
  tableName: "course", // 資料表名稱

  // === 欄位定義 ===
  columns: {
    // 課程 ID，主鍵，自動產生 UUID
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },

    // 課程名稱（例如：初階核心訓練）
    name: {
      type: "varchar",
      length: 50,
      nullable: true,
    },

    // 上課教練 ID（外鍵）
    coach_id: {
      type: "uuid",
      nullable: false,
    },

    // 課程介紹（長文）
    description: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },

    // 課程類別 ID（對應技能分類）
    type_id: {
      type: "uuid",
      nullable: true,
    },

    // 課程圖片網址
    image_url: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },
    image_public_id: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },
    // 課程評分（1.0 ~ 5.0，浮點數）
    score: {
      type: "float",
      nullable: false,
      default: 0.0,
    },
    // 觀看次數
    numbers_of_view: {
      type: "int",
      nullable: false,
      default: 0,
    },

    // 課程總時數（小時）
    total_hours: {
      type: "int",
      nullable: true,
    },

    //管理員審核留言(無論通過與否都可以留言，並被取得)
    review_comment: {
      type: "varchar",
      length: 200,
      nullable: true,
    },

    // 是否通過審核
    is_approved: {
      type: "boolean",
      nullable: false,
    },

    // 審核通過的時間(需經審核才有值)
    approved_at: {
      type: "timestamp",
      nullable: true,
    },

    // 建立時間（自動產生）
    created_at: {
      type: "timestamp",
      createDate: true,
    },

    // 更新時間（每次變更自動更新）
    updated_at: {
      type: "timestamp",
      updateDate: true,
    },
  },

  // === 關聯設定 ===
  relations: {
    // 每門課程由一位教練負責（多對一關聯）
    Coach: {
      target: "Coach",
      type: "many-to-one",
      joinColumn: {
        name: "coach_id", // 本表中的欄位名
        referencedColumnName: "id", // 對應 Coach 表的主鍵
        foreignKeyConstraintName: "fk_course_coach_id",
      },
      onDelete: "CASCADE", // 若該教練被刪除，所有課程也一併刪除
    },
    Skill: {
      target: "Skill",
      type: "many-to-one",
      joinColumn: {
        name: "type_id", // course 裡的欄位名稱
        referencedColumnName: "id", // skill 表的主鍵
        foreignKeyConstraintName: "fk_course_type_id",
      },
      onDelete: "RESTRICT", // 或 CASCADE，看你邏輯決定
    },
    ViewStat: {
      target: "View_Stat",
      type: "one-to-many",
      inverseSide: "Course",
    },
    User_Course_Favorite: {
      target: "User_Course_Favorite", // 關聯到中介表
      type: "one-to-many",
      inverseSide: "Course", // 對方 entity 裡的欄位名
    },
    Rating: {
      target: "Rating",
      type: "one-to-many",
      inverseSide: "Course",
    },
    Course_Chapter: {
      target: "Course_Chapter",
      type: "one-to-many",
      inverseSide: "Course",
    },
  },
});
