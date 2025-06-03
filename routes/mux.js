const express = require("express");
const router = express.Router();
const { muxUploadHandler } = require("../controllers/mux");

//取得從本地上傳影片的url
router.get("/upload-url", muxUploadHandler);

module.exports = router;
