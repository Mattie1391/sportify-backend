const express = require("express");
const router = express.Router();
const courseController = require("../controllers/course");
const ratingController = require("../controllers/rating");
const auth = require("../middlewares/auth");

//取得課程類別
router.get("/course-type", courseController.getCourseType);
//取得教練類別
router.get("/coach-type", courseController.getCoachType);
//取得課程評價
router.get("/:courseId/ratings", ratingController.getRatings);
//取得教練詳細資訊
router.get("/coaches/:coachId", courseController.getCoachDetails);
//取得課程詳細資訊
router.get("/:courseId/details", courseController.getCourseDetails);

module.exports = router;
