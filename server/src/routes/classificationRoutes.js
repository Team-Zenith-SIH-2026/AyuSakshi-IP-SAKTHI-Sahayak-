const express = require('express');
const router = express.Router();
const classificationController = require('../controllers/classificationController');
const { optionalAuth } = require('../middlewares/auth');
const { chatLimiter } = require('../middlewares/rateLimiter');

router.post('/classify', optionalAuth, chatLimiter, classificationController.classify);

module.exports = router;
