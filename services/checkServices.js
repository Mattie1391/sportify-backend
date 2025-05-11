const AppDataSource = require("../db/data-source");
const userRepo = AppDataSource.getRepository("User");
const courseRepo = AppDataSource.getRepository("Course");
const subscriptionRepo = AppDataSource.getRepository("Subscription");
const subscriptionSkillRepo = AppDataSource.getRepository("Subscription_Skill");

//取得此人最新的訂閱紀錄
const getLatestSubscription = async (userId) => {
  const result = await subscriptionRepo.findOne({
    where: { user_id: userId },
    order: { end_at: "DESC" },
    relations: ["Plan"],
  });
  return result;
};

//判斷訂閱是否有效
const hasActiveSubscription = async (userId) => {
  //取得此人最新的訂閱紀錄
  const latestSubscription = await getLatestSubscription(userId);
  // 沒有訂閱紀錄就直接回傳 false
  if (!latestSubscription) return false;

  const now = new Date();
  const validDate = new Date(latestSubscription.end_at);
  if (validDate > now) {
    return true; // 還沒過期就代表是有效會員
  }
  return false; // 已過期，會員失效
};

//判斷此人是否可觀看此類別(需先判斷訂閱是否有效)
const checkCategoryAccess = async (userId, courseId) => {
  //取得此人最新的訂閱紀錄
  const latestSubscription = await getLatestSubscription(userId);
  const course = await courseRepo.findOneBy({ id: courseId });
  const skill_Id = course.type_id; //取得此課程類別id
  const subscription_id = latestSubscription.id; //取得此人最新訂閱id

  //取得此人目前訂閱方案
  const planId = latestSubscription.plan_id;
  const plan = await userRepo.findOneBy({ id: planId });
  if (plan.sports_choice === 0) return true; //若為eagerness方案，回傳true（無論類別可觀看）

  //若非eagerness方案，查找subscription_skill資料表內，是否有對應資料
  const result = await subscriptionSkillRepo.findOneBy({
    subscription_id: subscription_id,
    skill_id: skill_Id,
  });
  return !!result; //若查有此資料，回傳true,否則回傳false
};

module.exports = {
  checkCategoryAccess,
  hasActiveSubscription,
  getLatestSubscription,
};
