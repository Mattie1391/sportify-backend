const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); 

router.post('/users/signup', authController.postSignup)
router.post('/users/login/email', authController.postLogin)
router.post('/coaches/signup', authController.postSignup)
router.post('/coaches/login/email', authController.postLogin)

module.exports = router;