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
    title: {
      type: "varchar",
      length: 100, //用戶輸入的證照名稱，例如CPR證書，由證照與資格去掉頓號後存入。
    },
    filename: {
      type: "varchar",
      length: 255, //用戶上傳的原檔名，可用以比對資料用。
    },
    file_url: {
      type: "varchar",
      length: 2048,
    },
    file_mimetype: {
      type: "varchar",
      length: 100, //檔案的媒體格式，如image/png、application/pdf
    },
    file_size: {
      type: "int",
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
