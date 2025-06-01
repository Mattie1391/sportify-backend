const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const isSelf = require("../middlewares/isSelf");
// const ownCourse = require("../middlewares/ownCourse");
const coachController = require("../controllers/coach");

//固定路由
//教練取得後台報表(觀看數、收益)
router.get("/data-analysis", auth, isCoach, coachController.getCoachAnalytics);
//教練取得自己所有課程
router.get("/courses", auth, isCoach, coachController.getOwnCourses);

//動態路由
router.patch("/:coachId", auth, isCoach, isSelf, coachController.patchProfile);

module.exports = router;
