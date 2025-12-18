const express = require('express');
const router = express.Router();
const unlockController = require('../controllers/unlockController');
const { protect, restrictTo } = require('../middleware/auth');

// ==== API DOCUMENTATION EXAMPLES ====

// POST /needs/:id/unlock - Unlock a need
// Request Body:
// {
//   "paymentMethod": "mpesa"
// }

// POST /unlocks/credits/purchase - Purchase credits
// Request Body:
// {
//   "credits": 5,
//   "paymentMethod": "mpesa"
// }

// Public routes
router.post('/mpesa/callback', unlockController.handleMpesaCallback);

// Protected routes
router.use(protect);

router.post('/credits/purchase', restrictTo('fulfiller'), unlockController.purchaseCredits);
router.get('/credits', restrictTo('fulfiller'), unlockController.getUserCredits);
router.get('/user/:userId?', restrictTo('fulfiller'), unlockController.getUserUnlocks);
router.get('/:id/status', restrictTo('fulfiller'), unlockController.checkUnlockStatus);

module.exports = router;