const express = require('express');
const router = express.Router();
const escalationController = require('../controllers/escalationController');
const { optionalAuth, authenticate, authorize } = require('../middlewares/auth');

router.post('/', optionalAuth, escalationController.submitEscalation);
router.get('/', authenticate, authorize(['facilitator', 'admin']), escalationController.listEscalations);
router.patch('/:id', authenticate, authorize(['facilitator', 'admin']), escalationController.updateEscalationStatus);

module.exports = router;
