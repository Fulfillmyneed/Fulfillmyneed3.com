const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { protect } = require('../middleware/auth');
const { ratingValidation } = require('../middleware/validation');

// ==== API DOCUMENTATION EXAMPLES ====

// POST /needs/:id/ratings - Create rating
// Request Body:
// {
//   "rating": 5,
//   "review": "Excellent service, very professional!"
// }

// Public routes
router.get('/user/:userId', ratingController.getUserRatings);

// Protected routes
router.use(protect);

router.post('/:id', ratingValidation.createRating, ratingController.createRating);

module.exports = router;