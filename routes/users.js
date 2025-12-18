const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// ==== API DOCUMENTATION EXAMPLES ====

// GET /users/:userId - Get user profile

// PUT /users/profile - Update profile
// Request Body:
// {
//   "fullName": "Updated Name",
//   "location": "Updated Location",
//   "bio": "Updated bio text",
//   "avatarUrl": "https://example.com/new-avatar.jpg"
// }

// Public routes
router.get('/:userId', userController.getUserProfile);

// Protected routes
router.use(protect);

router.put('/profile', userController.updateProfile);
router.post('/change-password', userController.changePassword);
router.get('/:userId/stats', userController.getUserStats);

module.exports = router;