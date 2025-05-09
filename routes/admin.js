const express = require("express");
const router = express.Router();
const ratingController = require("../controllers/rating");
const auth = require("../middlewares/auth");
const isAdmin = require("../middlewares/isAdmin");

//取得課程評價
router.get("/courses/:courseId/ratings", auth, isAdmin, ratingController.getRatings);

module.exports = router;