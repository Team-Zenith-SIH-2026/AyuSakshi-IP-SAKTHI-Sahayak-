const express = require('express');
const router = express.Router();
const classificationController = require('../controllers/classificationController');
const { optionalAuth } = require('../middlewares/auth');
const { chatLimiter } = require('../middlewares/rateLimiter');

router.post('/classify', optionalAuth, chatLimiter, classificationController.classify);

// Rule-based decision tree wizard
router.get('/wizard/tree', optionalAuth, classificationController.wizardTree);
router.post('/wizard/step', optionalAuth, chatLimiter, classificationController.wizardStep);

module.exports = router;
