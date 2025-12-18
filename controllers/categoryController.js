const { Category } = require('../models');

const categoryController = {
  // Get all categories
  getAllCategories: async (req, res) => {
    try {
      const categories = await Category.findAll({
        where: { isActive: true },
        order: [['sort_order', 'ASC']]
      });

      res.status(200).json({
        status: 'success',
        data: { categories }
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch categories.'
      });
    }
  },

  // Get category by ID with subcategories
  getCategory: async (req, res) => {
    try {
      const { id } = req.params;

      const category = await Category.findByPk(id, {
        include: [
          {
            model: Category,
            as: 'children',
            where: { isActive: true },
            required: false,
            order: [['sort_order', 'ASC']]
          }
        ]
      });

      if (!category) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found.'
        });
      }

      res.status(200).json({
        status: 'success',
        data: { category }
      });
    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch category.'
      });
    }
  }
};

module.exports = categoryController;