const AppDataSource = require("../db/data-source");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");

//取得課程章節資訊
const getChapters = async (courseId) => {
  const chapters = await courseChapterRepo.find({
    where: { course_id: courseId },
    order: {
      chapter_number: "ASC", //先按照主標題排序
      sub_chapter_number: "ASC", //按照副標題排序
    },
  });
  const chaptersData = [];
  chapters.forEach((chapter) => {
    // 嘗試找到該 title 的物件
    let group = chaptersData.find((g) => g.title === chapter.title);
    if (!group) {
      // 如果沒有這個 title，就建立一個新的物件
      group = { title: chapter.title, subtitles: [] };
      chaptersData.push(group);
    }
    group.subtitles.push(chapter.subtitle);
  });

  //回傳第一章節的第一小節id
  const firstChapterId = chapters[0].id;

  return {
    chapters: chaptersData,
    firstChapterId,
  };
};

module.exports = {
  getChapters,
};
