const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const isSelf = require("../middlewares/isSelf");
// const ownCourse = require("../middlewares/ownCourse");
const coachController = require("../controllers/coach");
const uploadController = require("../controllers/upload");

//固定路由
//取得所有課程觀看資料，或依照輸入的課程id找對應課程
router.get("/courses/views", auth, isCoach, coachController.getCoachViewStats);
//建立新課程
router.post("/course", auth, isCoach, coachController.postNewCourse);

//動態路由
//教練修改個人資料
router.patch("/:coachId", auth, isCoach, isSelf, coachController.patchProfile);

module.exports = router;
