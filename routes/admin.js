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
router.get("/coaches", auth, isAdmin, adminController.getCoaches);
//管理者刪除課程評價
router.delete("/courses/:courseId/ratings/:ratingId", auth, isAdmin, ratingController.deleteRating);
router.patch("/courses/:courseId/review", auth, isAdmin, adminController.patchReviewCourse);
module.exports = router;
