// ==== API DOCUMENTATION EXAMPLES ====
// These are example endpoints that match the API documentation

// POST /auth/register - Register new user
// Request Body:
// {
//   "fullName": "John Doe",
//   "email": "john@example.com",
//   "phone": "+254712345678",
//   "location": "Nairobi, Kenya",
//   "nationalId": "12345678",
//   "gender": "male",
//   "userType": "asker",
//   "categories": ["category-uuid-1", "category-uuid-2"],
//   "password": "SecurePassword123"
// }
// Response:
// {
//   "status": "success",
//   "message": "Registration successful...",
//   "data": {
//     "user": { ... },
//     "token": "jwt_token",
//     "refreshToken": "refresh_token"
//   }
// }

// POST /auth/login - Login user
// Request Body:
// {
//   "email": "john@example.com",
//   "password": "SecurePassword123"
// }
// Response:
// {
//   "status": "success",
//   "data": {
//     "user": { ... },
//     "token": "jwt_token",
//     "refreshToken": "refresh_token"
//   }
// }
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authValidation } = require('../middleware/validation');
const { protect, verifyEmailToken } = require('../middleware/auth');

// Public routes
router.post('/register', authValidation.register, authController.register);
router.post('/login', authValidation.login, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authValidation.forgotPassword, authController.forgotPassword);
router.post('/reset-password/:token', authValidation.resetPassword, authController.resetPassword);
router.post('/resend-verification', authController.resendVerification);
router.get('/verify-email/:token', verifyEmailToken, authController.verifyEmail);

// Protected routes
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

module.exports = router;