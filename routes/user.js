const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isUser = require("../middlewares/isUser");
const isSelf = require("../middlewares/isSelf");
const userController = require("../controllers/user");

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
  userController.postUnlike
);

module.exports = router;
