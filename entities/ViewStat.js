const { EntitySchema } = require("typeorm");

// 觀看次數資料表的 Entity 定義，每支影片/每天取得mux收視資料。
module.exports = new EntitySchema({
  name: "View_Stat", // Entity 名稱，用於程式中操作資料庫
  tableName: "view_stat", // 對應資料庫的實際資料表名稱

  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },
    course_id: {
      type: "uuid",
      nullable: false,
    },
    //外來鍵，章節小節組合的唯一識別碼
    chapter_sub_chapter_set_id: {
      type: "varchar",
      nullable: true,
    },
    // 採計觀看次數的日期
    date: {
      type: "timestamp",
      createDate: true,
    },
    //當日此asset(影片)的觀看次數
    view_count: {
      type: "int",
      nullable: true, //不確定是否有取得觀看次數null的狀況，先設true
    },
  },
  // === 關聯設定 ===
  relations: {
    //一門課程有多筆觀看資料，一筆觀看資料只屬於一門課程
    Course: {
      target: "Course",
      type: "many-to-one",
      joinColumn: {
        name: "course_id", //本表中的欄位名
        referencedColumnName: "id",
        foreignKeyConstraintName: "fk_view_stat_course_id",
      },
      onDelete: "CASCADE", // 若課程被刪除，對應的觀看次數資料也被刪除
    },
    //一個章節影片有多筆觀看資料，一筆觀看資料只屬於一個章節
    CourseChapter: {
      target: "Course_Chapter",
      type: "many-to-one",
      joinColumn: {
        name: "chapter_sub_chapter_set_id", //本表中的欄位名
        referencedColumnName: "id", //Course_Chapter表的主鍵名稱
        foreignKeyConstraintName: "fk_view_stat_course_chapter_id",
      },
      onDelete: "CASCADE", // 若影片被刪除，對應的觀看次數資料也被刪除
    },
  },
});
