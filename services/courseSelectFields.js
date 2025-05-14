const fullCourseFields = [
  "c.id AS course_id", //課程id
  "c.name AS course_name", //課程名稱
  "c.description AS course_description", //課程介紹
  "c.score AS course_score", //課程評分
  "c.total_hours AS total_hours", //課程總時長
  "c.image_url AS course_image_url", //課程封面
  "s.id AS type_id", //課程類別id
  "s.name AS course_type", //課程類別名稱
  "c.student_amount AS student_amount", //課程學生人數
  "coach.id AS coach_id", //教練id
  "coach.nickname AS coach_name", //教練名稱
  "coach.job_title AS coach_title", //教練title
];

module.exports = {
  fullCourseFields,
};
