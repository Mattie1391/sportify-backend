const express = require("express");
const router = express.Router();
const { chatWithGPT } = require("../controllers/chat");

router.post("/", chatWithGPT);

module.exports = router;
