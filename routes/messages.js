const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { messageValidation } = require('../middleware/validation');

// ==== API DOCUMENTATION EXAMPLES ====

// POST /needs/:id/messages - Send message
// Request Body:
// {
//   "message": "Hello, I can help with your plumbing need."
// }

// GET /messages/conversation/:userId?page=1&limit=20 - Get conversation

// Protected routes
router.use(protect);

router.post('/:id', messageValidation.sendMessage, messageController.sendMessage);
router.get('/:id', messageController.getConversation);
router.get('/', messageController.getUserConversations);

module.exports = router;