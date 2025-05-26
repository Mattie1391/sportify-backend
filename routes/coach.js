const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const ownCourse = require("../middlewares/ownCourse");
const coachController = require("../controllers/coach");

//固定路由
//取得所有課程觀看資料，或依照輸入的課程id找對應課程
router.get("/courses/views", auth, isCoach, coachController.getCoachViewStats);
//教練後台取得自己課程列表
router.get("/courses", auth, isCoach, coachController.getCoachCourses);

//動態路由

module.exports = router;
