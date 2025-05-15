const { EntitySchema } = require("typeorm");

// 課程影片表：儲存每一堂課的影片資訊
module.exports = new EntitySchema({
  name: "Course_Video",
  tableName: "course_video",
  columns: {
    mux_asset_id: {
      primary: true,
      type: "varchar",
    },
    mux_playback_id: {
      type: "varchar",
      length: 64,
      nullable: false,
    },
    chapter_subtitle_set_id: {
      type: "uuid", //fk，對應Course_Chapter表的主鍵，此主鍵代表了"一門課程id、章節與副標題(小節)編號三者組合的唯一識別碼"
      nullable: false,
    },
    duration: {
      type: "float",
      nullable: true,
    },
    status: {
      type: "varchar",
      length: 32,
      default: "waiting",
    },
    // position: {
    //   type: "int",
    //   default: 1,
    // },
    created_at: {
      type: "timestamp",
      createDate: true,
    },
  },
  relations: {
    Course_Chapter: {
      target: "Course_Chapter",
      type: "many-to-one",
      joinColumn: {
        name: "chapter_subtitle_set_id", //本表的欄位
        referencedColumnName: "id", //對方表的主鍵名稱
        foreignKeyConstraintName: "fk_video_chapter_id",
      },
      onDelete: "CASCADE",
    },
    ViewStat: {
      target: "View_Stat",
      type: "many-to-many",
      inverseSide: "Course_Video",
    },
  },
});
