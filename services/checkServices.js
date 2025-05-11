const subscriptionRepo = require("../db/data-source").getRepository("Subscription");

const checkCategoryAccess = async (userId, courseId) => {
  const result = await subscriptionRepo
    .createQueryBuilder("s")
    .innerJoin("s.Subscription_Skill", "sk")
    .where("s.user_id = :userId", { userId })
    .innerJoin("course", "course", "course.id = :courseId", { courseId })
    .andWhere("course.type_id = sk.skill_id")
    .getOne();

  return result;
};

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

module.exports = {
  checkCategoryAccess,
  hasActiveSubscription,
  getLatestSubscription,
};
