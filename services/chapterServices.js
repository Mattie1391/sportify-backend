const AppDataSource = require("../db/data-source");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");

//取得課程章節資訊
const getChapters = async (courseId) => {
  const chapters = await courseChapterRepo.find({
    where: { course_id: courseId },
    order: {
      chapter_number: "ASC",
      id: "ASC", // 若 subtitle 有數字順序也可用它
    },
  });
  const chaptersData = [];
  chapters
    .sort((a, b) => {
      // 確保排序順序正確：先比大章節，再比副章節
      if (a.chapter_number === b.chapter_number) {
        return a.sub_chapter_number - b.sub_chapter_number;
      }
      return a.chapter_number - b.chapter_number;
    })
    .forEach((chapter) => {
      // 嘗試找到該 title 的物件
      let group = chaptersData.find((g) => g.title === chapter.title);
      if (!group) {
        // 如果沒有這個 title，就建立一個新的物件
        group = { title: chapter.title, subtitles: [] };
        chaptersData.push(group);
      }
      group.subtitles.push(chapter.subtitle);
    });

  return chaptersData;
};

module.exports = {
  getChapters,
};
