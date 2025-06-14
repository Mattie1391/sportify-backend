const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();
const { muxUploadHandler, muxWebhookHandler } = require("../controllers/mux");

const isCouch = require("../middlewares/isCoach");
const auth = require("../middlewares/auth");

//取得從本地上傳影片的url
router.post("/upload-url", auth, isCouch, muxUploadHandler);

//webhook取得上傳結果
//express.raw middleware : mux驗證原始body
router.post("/webhook", bodyParser.raw({ type: "application/json" }), muxWebhookHandler);

module.exports = router;
