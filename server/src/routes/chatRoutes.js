const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middlewares/auth');
const { chatLimiter } = require('../middlewares/rateLimiter');
const { auditMiddleware } = require('../middlewares/audit');

const blockNonChatRoles = (req, res, next) => {
  if (req.user && (req.user.role === 'facilitator' || req.user.role === 'admin')) {
    return res.status(403).json({
      success: false,
      error: `Access to conversational AI is restricted for ${req.user.role} accounts.`,
    });
  }
  next();
};

router.get('/conversations', optionalAuth, blockNonChatRoles, chatController.listConversations);
router.post('/conversations', optionalAuth, blockNonChatRoles, auditMiddleware('CREATE_CONVERSATION', 'CONVERSATION'), chatController.createConversation);
router.get('/conversations/:id', optionalAuth, blockNonChatRoles, chatController.getConversationMessages);
router.post('/conversations/:id/messages', optionalAuth, blockNonChatRoles, chatLimiter, auditMiddleware('SEND_MESSAGE', 'MESSAGE'), chatController.sendMessage);
router.delete('/conversations/:id', optionalAuth, blockNonChatRoles, chatController.deleteConversation);

module.exports = router;
