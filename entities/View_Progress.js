const { EntitySchema } = require("typeorm");

// 教練與技能的中介表，記錄每位教練擁有哪些技能（多對多關係）
// 每筆資料代表「某位教練擁有某一個技能」
module.exports = new EntitySchema({
  name: "View_Progress", // Entity 名稱，用於程式內使用 getRepository("CoachSkill") 查詢
  tableName: "view_progress", // 對應資料庫中的資料表名稱

  // === 欄位定義 ===
  columns: {
    // 教練 ID，是主鍵的一部分，同時也是外鍵
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid", // 自動產生 UUID
    },
    user_id: {
      type: "uuid",
      nullable: false,
    },
    sub_chapter_id: {
      type: "uuid",
      nullable: false,
    },
    is_completed: {
      type: "boolean",
      nullable: false,
    },
    created_at: {
      type: "timestamp",
      createDate: true,
    },
  },

  // === 關聯定義 ===
  relations: {
    // User: 多對一關聯（many-to-one）
    // 一位學員有多筆觀看紀錄
    User: {
      target: "User", // 關聯的目標 Entity 名稱（
      type: "many-to-one",
      joinColumn: {
        name: "user_id", // 本表中使用的欄位名稱
        referencedColumnName: "id", // User 資料表中對應的欄位
        foreignKeyConstraintName: "fk_view_proress_user_id", // 外鍵名稱，可自定，方便資料庫管理
      },
      onDelete: "CASCADE", // 若 User 被刪除，對應的所有技能連結也會自動刪除
    },
    //每個小節影片有多筆觀看紀錄
    Course_Chapter: {
      target: "Course_Chapter", // 關聯的目標 Entity 名稱（
      type: "many-to-one",
      joinColumn: {
        name: "sub_chapter_id", // 本表中使用的欄位名稱
        referencedColumnName: "id", // 課程章節資料表中對應的欄位
        foreignKeyConstraintName: "fk_view_proress_chapter_id", // 外鍵名稱，可自定，方便資料庫管理
      },
      onDelete: "CASCADE", // 若 課程章節資料表 被刪除，對應的所有技能連結也會自動刪除
    },
  },
});
