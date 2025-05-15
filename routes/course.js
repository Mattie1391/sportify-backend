const express = require("express");
const router = express.Router();
const courseController = require("../controllers/course");
const ratingController = require("../controllers/rating");
const auth = require("../middlewares/auth");

//固定路由
//固定路由順序要放在動態路由前，如:userId，否則會被/:userId的路由攔截

//取得課程類別
router.get("/course-type", courseController.getCourseType);
//取得教練類別
router.get("/coach-type", courseController.getCoachType);
//取得課程列表
router.get("/", courseController.getCourses);
//取得教練列表
router.get("/coaches", courseController.getCoaches);

//動態路由
//取得課程評價
router.get("/:courseId/ratings", ratingController.getRatings);
//取得教練詳細資訊
router.get("/coaches/:coachId", courseController.getCoachDetails);
//取得教練已開設課程
router.get("/:coachId", courseController.getCoachCourses);
//取得課程詳細資訊
router.get("/:courseId/details", courseController.getCourseDetails);
//取得你可能會喜歡課程
router.get("/:courseId/recommend", courseController.getRecommandCourses);

module.exports = router;
