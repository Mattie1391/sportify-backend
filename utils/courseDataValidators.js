const Joi = require("joi");

//定義sub_chapter驗證模式 schema:框架、規範
const subChapterSchema = Joi.object({
  sub_chapter_number: Joi.number().integer().required().messages({
    "number.base": "章節編號必須是數字", //.base意該規則的基本失敗情況
    "any.required": "章節編號為必填欄位",
  }),
  subtitle: Joi.string().min(2).required().messages({
    "string.base": "小節名稱格式錯誤",
    "string.min": "小節名稱至少需要2個字元",
    "any.required": "小節名稱為必填欄位",
  }),
});

//定義chapter驗證模式
const chapterSchema = Joi.object({
  chapter_number: Joi.number().integer().required().messages({
    "number.base": "章節編號必須是數字",
    "any.required": "章節編號為必填欄位",
  }),
  chapter_name: Joi.string().min(2).required().messages({
    "string.base": "章節名稱格式錯誤",
    "string.min": "章節名稱至少需要2個字元",
    "any.required": "章節名稱為必填欄位",
  }),
  sub_chapter: Joi.array().items(subChapterSchema).min(1).required().messages({
    "array.base": "小節必須是陣列",
    "array.min": "小節至少要有一個元素",
    "any.required": "小節至少要有一個元素",
  }),
});

//定義整個course data的驗證模式
const chaptersArraySchema = Joi.array().items(chapterSchema).min(1).required().messages({
  "array.base": "章節必須是陣列",
  "array.min": "章節至少要有一個元素",
  "any.required": "章節至少要有一個元素",
});

module.exports = {
  subChapterSchema,
  chapterSchema,
  chaptersArraySchema,
};
