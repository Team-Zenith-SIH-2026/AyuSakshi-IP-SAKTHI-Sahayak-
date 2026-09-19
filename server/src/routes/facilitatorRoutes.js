const express = require('express');
const router = express.Router();
const facilitatorController = require('../controllers/facilitatorController');
const { authenticate, authorize } = require('../middlewares/auth');

// Facilitator routes strictly require authentication and role = 'facilitator'
router.use(authenticate, authorize(['facilitator']));

router.get('/requests', facilitatorController.getAssignedRequests);
router.get('/requests/:id', facilitatorController.getRequestDetail);
router.patch('/requests/:id/status', facilitatorController.updateRequestStatus);

module.exports = router;
