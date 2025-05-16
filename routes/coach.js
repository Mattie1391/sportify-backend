const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const ownCourse = require("../middlewares/ownCourse");
const coachController = require("../controllers/coach");

router.get(
  "/courses/:courseId/views",
  auth,
  isCoach,
  ownCourse,
  coachController.getCoachViewStat
);

module.exports = router;
