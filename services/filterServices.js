const { checkSkillAccess } = require("./checkServices");

//根據類別篩選課程
const filterByCategory = async (courses, category, skillId, userId) => {
  //篩選已收藏課程
  if (category === "favorite") {
    return courses.filter((course) => course.isFavorited);
  }
  //篩選特定類別課程
  if (category === "skill" && skillId) {
    const canWatch = await checkSkillAccess(userId, skillId);
    if (!canWatch) throw generateError(403, "未訂閱該課程類別");
    return courses.filter((course) => course.course_type === skillId);
  }

  return courses; // 預設回傳全部課程
};

module.exports = {
  filterByCategory,
};
