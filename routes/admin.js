const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const ratingController = require("../controllers/rating");
const auth = require("../middlewares/auth");
const isAdmin = require("../middlewares/isAdmin");

//取得課程評價
router.get(
  "/courses/:courseId/ratings",
  auth,
  isAdmin,
  ratingController.getRatings
);

router.post("/add-plan", auth, isAdmin, adminController.postPlan);
router.post("/add-sports-type", auth, isAdmin, adminController.postSportsType);

module.exports = router;
