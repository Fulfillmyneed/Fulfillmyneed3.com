// ==== API DOCUMENTATION EXAMPLES ====

// POST /needs - Create a new need
// Request Body:
// {
//   "title": "Need a plumber for leaky tap",
//   "description": "Kitchen sink has a leak that needs fixing",
//   "budget": 1500,
//   "location": "Nairobi, Westlands",
//   "categoryId": "uuid-of-category",
//   "timeline": "As soon as possible",
//   "contactPrefs": ["whatsapp", "call"],
//   "photoUrls": ["https://example.com/photo1.jpg"]
// }

// GET /needs?page=1&limit=20&category=uuid&location=Nairobi&minBudget=500&maxBudget=5000&q=plumber
// Get needs with filters
const express = require('express');
const router = express.Router();
const needController = require('../controllers/needController');
const { needValidation, queryValidation } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes (with optional auth)
router.get(
  '/',
  queryValidation.pagination,
  queryValidation.search,
  needController.getAllNeeds
);

router.get('/:id', needController.getNeed);

// Protected routes
router.use(protect);

router.post(
  '/',
  restrictTo('asker'),
  needValidation.createNeed,
  needController.createNeed
);

router.put(
  '/:id',
  needValidation.needId,
  needValidation.updateNeed,
  needController.updateNeed
);

router.delete(
  '/:id',
  needValidation.needId,
  needController.deleteNeed
);

router.post(
  '/:id/fulfill',
  needValidation.needId,
  needController.markAsFulfilled
);

router.post(
  '/:id/extend',
  needValidation.needId,
  needController.extendExpiration
);

// User needs
router.get(
  '/user/:userId',
  needValidation.needId,
  needController.getUserNeeds
);

// Upload photos
router.post(
  '/:id/upload',
  upload.array('photos', 5),
  async (req, res) => {
    try {
      const { id } = req.params;
      const need = await Need.findByPk(id);

      if (!need) {
        return res.status(404).json({
          status: 'error',
          message: 'Need not found.'
        });
      }

      // Check ownership
      if (need.askerId !== req.user.id) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only upload photos to your own needs.'
        });
      }

      // Get uploaded file URLs
      const photoUrls = req.files.map(file => `/uploads/${file.filename}`);

      // Add to existing photos
      const updatedPhotos = [...need.photoUrls, ...photoUrls].slice(0, 10); // Max 10 photos

      // Update need
      await need.update({ photoUrls: updatedPhotos });

      res.status(200).json({
        status: 'success',
        message: 'Photos uploaded successfully.',
        data: { photoUrls }
      });
    } catch (error) {
      console.error('Upload photos error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to upload photos.'
      });
    }
  }
);

module.exports = router;