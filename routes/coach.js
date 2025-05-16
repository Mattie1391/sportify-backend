const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const ownCourse = require("../middlewares/ownCourse");
const coachController = require("../controllers/coach");

//浮動路由
router.get(
  "/courses/:courseId/views",
  auth,
  isCoach,
  ownCourse,
  coachController.getCoachViewStat
);

//動態路由
//取得所有課程觀看資料，或依照輸入的課程id找對應課程
router.get("/courses/views", auth, isCoach, coachController.getCoachViewStats);

module.exports = router;
