const express = require("express");
const router = express.Router();
const courseController = require("../controllers/course");

router.get("/course-type", courseController.getCourseType);
router.get("/coach-type", courseController.getCoachType);

module.exports = router;
