const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const ratingController = require("../controllers/rating");
const auth = require("../middlewares/auth");
const isAdmin = require("../middlewares/isAdmin");

//固定路由
//固定路由順序要放在動態路由前，如:userId，否則會被/:userId的路由攔截

//新增訂閱方案
router.post("/add-plan", auth, isAdmin, adminController.postPlan);
//新增運動類別
router.post("/add-sports-type", auth, isAdmin, adminController.postSportsType);
//取得課程列表篩選類別
router.get("/course-type", auth, isAdmin, adminController.getCourseTypes);
//取得教練列表篩選類別
router.get("/coach-type", auth, isAdmin, adminController.getCoachTypes);
//取得課程列表
router.get("/courses", auth, isAdmin, adminController.getCourses);
//取得教練列表
router.get("/coaches", auth, isAdmin, adminController.getCoaches);
//取得後台數據分析
router.get("/data-analysis", auth, isAdmin, adminController.getDataAnalysis);

//動態路由
//取得課程評價
router.get("/courses/:courseId/ratings", auth, isAdmin, ratingController.getRatings);
//刪除課程評價
router.delete("/courses/:courseId/ratings/:ratingId", auth, isAdmin, ratingController.deleteRating);
//審核課程是否上架
router.patch("/courses/:courseId/review", auth, isAdmin, adminController.patchReviewCourse);

module.exports = router;
