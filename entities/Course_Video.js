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
    chapter_section_id: {
      type: "varchar", //使用serial編排章節-小節。如1-1、1-2、2-1
      nullable: false,
    },
    duration: {
      type: "int",
      nullable: true,
    },
    status: {
      type: "varchar",
      length: 32,
      default: "waiting",
    },
    resolution_tier: {
      type: "varchar",
      length: 16,
      nullable: true,
    },
    position: {
      type: "int",
      default: 1,
    },
    thumbnail_url: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },
    created_at: {
      type: "timestamp",
      createDate: true,
    },
    updated_at: {
      type: "timestamp",
      updateDate: true,
    },
  },
  relations: {
    Chapter: {
      target: "Course_Chapter",
      type: "many-to-one",
      joinColumn: {
        name: "chapter_id",
        referencedColumnName: "id",
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
