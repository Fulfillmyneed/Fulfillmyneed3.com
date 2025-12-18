const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// ==== API DOCUMENTATION EXAMPLES ====

// GET /categories - Get all categories

// GET /categories/:id - Get category with subcategories

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);

module.exports = router;