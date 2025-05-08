const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isUser = require("../middlewares/isUser");
const isSelf = require("../middlewares/isSelf");
const userController = require("../controllers/user");

//固定路由
//固定路由順序要放在動態路由前，如:userId，否則會被/:userId的路由攔截
router.get("/course-type", auth, isUser, userController.getCourseType);

//取得所有訂閱資訊
router.get("/subscription-info", userController.getSubscriptionPlans);

//動態路由
router.get("/:userId", auth, isUser, isSelf, userController.getProfile);
router.patch("/:userId", auth, isUser, isSelf, userController.patchProfile);
router.post(
  "/:userId/favorites/:courseId",
  auth,
  isUser,
  isSelf,
  userController.postLike
);
router.delete(
  "/:userId/favorites/:courseId",
  auth,
  isUser,
  isSelf,
  userController.deleteUnlike
);

module.exports = router;
