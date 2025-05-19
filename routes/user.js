const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isUser = require("../middlewares/isUser");
const isSelf = require("../middlewares/isSelf");
const userController = require("../controllers/user");
const ratingController = require("../controllers/rating");

//固定路由
//固定路由順序要放在動態路由前，如:userId，否則會被/:userId的路由攔截

//取得可觀看類別
router.get("/course-type", auth, isUser, userController.getCourseType);
//取得可觀看課程
router.get("/courses", auth, isUser, userController.getCourses);
//取得所有訂閱方案類別
router.get("/plan-info", userController.getPlans);
//取得所有運動類別
router.get("/show-sports-type", userController.getAllCourseType);
//取得訂閱紀錄
router.get("/subscriptions", auth, isUser, userController.getSubscriptions);
//新增訂閱方案
router.post("/subscription", auth, isUser, userController.postSubscription);
//取消訂閱方案
router.patch("/subscription", auth, isUser, userController.patchSubscription);

//動態路由

//取得使用者資料
router.get("/:userId", auth, isUser, isSelf, userController.getProfile);
//編輯使用者資料
router.patch("/:userId", auth, isUser, isSelf, userController.patchProfile);
//收藏課程
router.post("/:userId/favorites/:courseId", auth, isUser, isSelf, userController.postLike);
//取消收藏課程
router.delete("/:userId/favorites/:courseId", auth, isUser, isSelf, userController.deleteUnlike);
//取得課程評價
router.get("/courses/:courseId/ratings", auth, isUser, ratingController.getRatings);
//新增課程評價
router.post("/:userId/ratings/:courseId", auth, isUser, isSelf, ratingController.postRating);
//修改課程評價
router.patch("/:userId/rating/:courseId", auth, isUser, isSelf, ratingController.patchRating);

module.exports = router;
