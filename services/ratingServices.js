const AppDataSource = require("../db/data-source");
const ratingRepo = AppDataSource.getRepository("Rating");
const courseRepo = AppDataSource.getRepository("Course");

//更新課程的評分
const updateCourseScore = async (courseId) => {
  // 根據課程 ID 查詢所有評價紀錄
  const ratings = await ratingRepo.find({
    where: { course_id: courseId },
  });

  // 計算所有評分的總和
  const totalRating = ratings.reduce((sum, rating) => sum + rating.score, 0);

  // 計算平均分數，如果沒有評分則為 0
  const averageRating = ratings.length ? totalRating / ratings.length : 0;

  // 將平均分數四捨五入到小數點第一位，並更新到課程資料表中
  await courseRepo.update(courseId, {
    score: Math.round(averageRating * 10) / 10,
  });
};

module.exports = {
  updateCourseScore,
};