//根據類別篩選課程
const courseFilterByCategory = async (courses, category, skillId) => {
  //篩選已收藏課程
  if (category === "favorite") {
    return courses.filter((course) => course.isFavorited);
  }
  //篩選特定類別課程
  if (category === "skill" && skillId) {
    return courses.filter((course) => course.type_id === skillId);
  }

  return courses; // 預設回傳全部課程
};

//根據類別篩選教練
const coachFilterByCategory = async (coaches, category, skillId) => {
  //篩選特定類別教練
  if (category === "skill" && skillId) {
    return coaches.filter((coach) =>
      coach.coach_skills.some((skill) => skill.skill_id === skillId)
    );
  }
  return coaches; // 預設回傳全部教練資料
};

module.exports = {
  courseFilterByCategory,
  coachFilterByCategory,
};
