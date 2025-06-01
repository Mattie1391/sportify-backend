const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const isSelf = require("../middlewares/isSelf");
// const ownCourse = require("../middlewares/ownCourse");
const coachController = require("../controllers/coach");

//固定路由
//取得所有課程觀看資料，或依照輸入的課程id找對應課程
router.get("/courses/views", auth, isCoach, coachController.getCoachViewStats);
//教練取得自己所有課程
router.get("/courses", auth, isCoach, coachController.getOwnCourses);

//動態路由
router.patch("/:coachId", auth, isCoach, isSelf, coachController.patchProfile);

module.exports = router;
