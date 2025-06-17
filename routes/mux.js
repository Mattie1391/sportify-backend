const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();
const muxController = require("../controllers/mux");

//middleware
const isCouch = require("../middlewares/isCoach");
const auth = require("../middlewares/auth");

//取得從本地上傳影片的url
router.post("/upload-url", auth, isCouch, muxController.muxUploadHandler);

//webhook取得上傳結果
//express.raw middleware : mux驗證原始body
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  muxController.muxWebhookHandler
);

module.exports = router;
