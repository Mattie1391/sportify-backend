const subscriptionRepo =
  require("../db/data-source").getRepository("Subscription");

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
module.exports = {
  checkCategoryAccess,
};
