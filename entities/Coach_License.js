const { EntitySchema } = require("typeorm");

//教練證照資料表的Entity定義
module.exports = new EntitySchema({
  name: "Coach_License",
  tableName: "coach_license",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    coach_id: {
      type: "uuid",
      nullable: true, // 或 true 看你的需求
    },
    filename: {
      type: "varchar",
      length: 255, //用戶上傳的原檔名，可用以比對資料用。
      nullable: true,
    },
    file_url: {
      type: "varchar",
      length: 2048,
      nullable: true,
    },
    file_mimetype: {
      type: "varchar",
      length: 100, //檔案的媒體格式，如image/png、application/pdf
      nullable: true,
    },
    file_size: {
      type: "int",
      nullable: true,
    },
    status: {
      type: "varchar",
      length: 20,
      default: "pending",
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
    Coach: {
      target: "Coach",
      type: "many-to-one", //一個教練有好幾筆檔案
      joinColumn: {
        name: "coach_id", //本表的欄位
        referencedColumnName: "id", // Coach 表中的主鍵
        foreignKeyConstraintName: "fk_coach_license_coach_id",
      },
      onDelete: "CASCADE",
    },
  },
});
