const express = require("express");
const router = express.Router();
const courseController = require("../controllers/course");
const ratingController = require("../controllers/rating");
const auth = require("../middlewares/auth");

router.get("/course-type", courseController.getCourseType);
router.get("/coach-type", courseController.getCoachType);

//取得課程評價
router.get("/:courseId/ratings", auth, ratingController.getRatings);

module.exports = router;
