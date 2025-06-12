const express = require("express");
const router = express.Router();

//middlewares
const auth = require("../middlewares/auth");
const isCoach = require("../middlewares/isCoach");
const isSelf = require("../middlewares/isSelf");
const upload = require("../middlewares/upload");
const strTrimmer = require("../middlewares/strTrimmer");
// const ownCourse = require("../middlewares/ownCourse");

//controllers
const coachController = require("../controllers/coach");
const {
  uploadCoachAvatar,
  uploadBankbook,
  uploadLicense,
  uploadBackground,
  uploadCourseThumbnail,
} = require("../controllers/upload");
const { updateCourseScore } = require("../services/ratingServices");

//固定路由
//取得所有課程觀看資料，或依照輸入的課程id找對應課程
router.get("/courses/views", auth, isCoach, coachController.getCoachViewStats);
//建立新課程
router.post("/course", auth, isCoach, coachController.postNewCourse);
//教練取得自己所有課程
router.get("/courses", auth, isCoach, coachController.getOwnCourses);
//教練上傳大頭貼
router.post("/upload-avatar", auth, isCoach, upload.single("coachAvatar"), uploadCoachAvatar);
//教練上傳存摺封面
router.post("/upload-bankbook", auth, isCoach, upload.single("bankbook"), uploadBankbook);
//教練上傳證照
router.post("/upload-license", auth, isCoach, upload.single("license"), uploadLicense);
//教練上傳背景圖片
router.post(
  "/upload-background-image",
  auth,
  isCoach,
  upload.single("background"),
  uploadBackground
);
//教練上傳課程封面
router.post(
  "/upload-course-thumbnail",
  auth,
  isCoach,
  upload.single("courseThumbnail"),
  uploadCourseThumbnail
);

//動態路由
//教練修改個人資料
router.patch("/:coachId", auth, isCoach, isSelf, strTrimmer, coachController.patchProfile);
//取得教練個人資料
router.get("/:coachId", auth, isCoach, isSelf, coachController.getProfile);
//編輯課程
router.patch("/courses/:courseId", auth, isCoach, strTrimmer, coachController.patchCourse);

module.exports = router;
