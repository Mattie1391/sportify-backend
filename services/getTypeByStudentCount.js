const AppDataSource = require("../db/data-source");
const skillRepo = AppDataSource.getRepository("Skill");
//取得類別的id、名稱、學生人數（依照學生人數排序）
const getTypeByStudentCount = async () => {
  const result = await skillRepo
    .createQueryBuilder("s") //s=Skill資料表
    .innerJoin("s.Course", "c") //c=Course資料表
    .select([
      "s.id AS skill_id",
      "s.name AS course_type",
      "SUM(c.student_amount) AS student_count",
    ])
    .groupBy("s.id") // 聚合相同課程類別,計算每個類別下有多少學生
    .orderBy("student_count", "DESC") //按學生人數排序，讓熱門課程類別排在前面
    .getRawMany();

  return result;
};

module.exports = {
  getTypeByStudentCount,
};
