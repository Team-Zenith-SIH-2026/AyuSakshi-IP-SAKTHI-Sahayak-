const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middlewares/auth');
const { chatLimiter } = require('../middlewares/rateLimiter');
const { auditMiddleware } = require('../middlewares/audit');

router.get('/conversations', optionalAuth, chatController.listConversations);
router.post('/conversations', optionalAuth, auditMiddleware('CREATE_CONVERSATION', 'CONVERSATION'), chatController.createConversation);
router.get('/conversations/:id', optionalAuth, chatController.getConversationMessages);
router.post('/conversations/:id/messages', optionalAuth, chatLimiter, auditMiddleware('SEND_MESSAGE', 'MESSAGE'), chatController.sendMessage);
router.delete('/conversations/:id', optionalAuth, chatController.deleteConversation);

module.exports = router;
