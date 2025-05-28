const AppDataSource = require("../db/data-source");
const skillRepo = AppDataSource.getRepository("Skill");
const subscriptionSkillRepo = AppDataSource.getRepository("Subscription_Skill");
const { getLatestSubscription } = require("./checkServices");

//前台公開頁面取得所有類別（依照學生人數排序）
//回傳id、類別名稱、該類別學生總人數
const getAllCourseTypes = async () => {
  const result = await skillRepo
    .createQueryBuilder("s") //s=Skill資料表
    .innerJoin("s.Course", "c") //c=Course資料表
    .select(["s.id AS skill_id", "s.name AS course_type", "SUM(c.student_amount) AS student_count"])
    .groupBy("s.id") // 聚合相同課程類別,計算每個類別下有多少學生
    .orderBy("student_count", "DESC") //按學生人數排序，讓熱門課程類別排在前面
    .getRawMany();

  return result;
};

//學員取得可觀看的課程類別（依照學生人數排序）
const getViewableCourseTypes = async (userId) => {
  //取得此人最新的訂閱紀錄
  const latestSubscription = await getLatestSubscription(userId);
  const isEagerness = Number(latestSubscription.Plan.sports_choice) === 0;
  let result = [];
  //如果是eagerness方案,取得所有類別
  if (isEagerness) {
    result = await getAllCourseTypes();
    //如果是eagerness方案,取得所有類別
    if (Number(latestSubscription.Plan.sports_choice) === 0) {
      result = await getAllCourseTypes();
    } else {
      //若非eagerness,取得訂閱時選擇的類別
      result = await subscriptionSkillRepo
        .createQueryBuilder("ss") // s = SubscriptionSkill資料表
        .innerJoin("ss.Skill", "sk") // sk = Skill資料表
        .innerJoin("sk.Course", "c") // c = Course資料表
        .select(["sk.id AS skill_id", "sk.name AS course_type"]) // 選擇 skill.id 和 skill.name 欄位
        .addSelect("SUM(c.student_amount) AS student_count") // 計算該類別學生
        .where("ss.subscription_id = :Id", { Id: latestSubscription.id }) //關聯最新訂閱紀錄
        .groupBy("sk.id") // 聚合相同課程類別，這樣可以計算每個類別下有多少學生
        .orderBy("student_count", "DESC") // 按學生人數排序，讓熱門課程類別排在前面
        .getRawMany();
    }
  }
  // 從類別資料中取出 ID 陣列
  const typeIds = result.map((type) => type.skill_id);
  return { isEagerness, result, typeIds };
};

module.exports = {
  getAllCourseTypes,
  getViewableCourseTypes,
};
