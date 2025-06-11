//此模組儲存用以分解巢狀的章節小節課程資料，以及反向組裝回巢狀的工具

const chapterDestructor = (data) => {
  const chapterMap = new Map();
  const subChapterMap = new Map();

  for (const ch of data) {
    chapterMap.set(ch.chapter_number, ch);
    for (const sub of ch.sub_chapter || []) {
      subChapterMap.set(sub.subchapter_number, sub);
    }
  }
  return {
    chapterMap,
    subChapterMap,
  };
};

module.exports = {
  chapterDestructor,
};
