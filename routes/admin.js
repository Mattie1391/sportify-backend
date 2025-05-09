const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const isAdmin = require("../middlewares/isAdmin");
const adminController = require("../controllers/admin");

router.post("/add-plan", auth, isAdmin, adminController.postPlan);

module.exports = router;
