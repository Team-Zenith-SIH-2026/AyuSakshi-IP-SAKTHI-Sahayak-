const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middlewares/auth');

// All admin routes strictly require authentication and role = 'admin'
router.use(authenticate, authorize(['admin']));

router.get('/summary', adminController.getDashboardSummary);

router.get('/facilitators', adminController.listFacilitators);
router.post('/facilitators', adminController.createFacilitator);
router.patch('/facilitators/:id/status', adminController.toggleFacilitatorStatus);
router.post('/facilitators/:id/reset-password', adminController.resetFacilitatorPassword);

router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);

router.get('/requests', adminController.listReviewRequests);

module.exports = router;
