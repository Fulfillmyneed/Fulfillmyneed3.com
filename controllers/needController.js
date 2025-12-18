const { Op } = require('sequelize');
const { Need, User, Category, Unlock, Rating } = require('../models');
const { sendNotification } = require('../utils/notificationService');
const { sendEmail } = require('../utils/emailService');

const needController = {
  // Create a new need
  createNeed: async (req, res) => {
    try {
      const {
        title,
        description,
        budget,
        currency = 'KES',
        location,
        latitude,
        longitude,
        timeline,
        categoryId,
        contactPrefs = ['whatsapp', 'call'],
        photoUrls = []
      } = req.body;

      // Check if category exists
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found.'
        });
      }

      // Check if user is asker
      if (req.user.userType !== 'asker') {
        return res.status(403).json({
          status: 'error',
          message: 'Only askers can create needs.'
        });
      }

      // Create the need
      const need = await Need.create({
        title,
        description,
        budget: parseFloat(budget),
        currency,
        location,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        timeline,
        categoryId,
        askerId: req.user.id,
        contactPrefs,
        photoUrls: Array.isArray(photoUrls) ? photoUrls : [photoUrls]
      });

      // Get need with user and category details
      const needWithDetails = await Need.findByPk(need.id, {
        include: [
          {
            model: User,
            as: 'asker',
            attributes: ['id', 'fullName', 'avatarUrl', 'rating', 'totalRatings']
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon']
          }
        ]
      });

      // Notify matching fulfillers
      await sendMatchingFulfillerNotifications(needWithDetails);

      res.status(201).json({
        status: 'success',
        message: 'Need created successfully.',
        data: { need: needWithDetails }
      });
    } catch (error) {
      console.error('Create need error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create need.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get all needs (with filters)
  getAllNeeds: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'newest',
        category,
        location,
        minBudget,
        maxBudget,
        q: searchTerm,
        userId,
        status
      } = req.query;

      // Build filter object
      const where = {};
      
      // Filter by status
      if (status) {
        where.status = status;
      } else {
        // Default: show active needs that haven't expired
        where.status = 'active';
        where.expiresAt = { [Op.gt]: new Date() };
      }

      // Filter by user
      if (userId) {
        where.askerId = userId;
      }

      // Filter by category
      if (category) {
        where.categoryId = category;
      }

      // Filter by location
      if (location) {
        where.location = { [Op.iLike]: `%${location}%` };
      }

      // Filter by budget range
      if (minBudget || maxBudget) {
        where.budget = {};
        if (minBudget) where.budget[Op.gte] = parseFloat(minBudget);
        if (maxBudget) where.budget[Op.lte] = parseFloat(maxBudget);
      }

      // Search by title or description
      if (searchTerm) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${searchTerm}%` } },
          { description: { [Op.iLike]: `%${searchTerm}%` } }
        ];
      }

      // Determine sort order
      let order = [];
      switch (sort) {
        case 'oldest':
          order = [['created_at', 'ASC']];
          break;
        case 'budget_high':
          order = [['budget', 'DESC']];
          break;
        case 'budget_low':
          order = [['budget', 'ASC']];
          break;
        case 'popular':
          order = [['view_count', 'DESC']];
          break;
        default: // 'newest'
          order = [['created_at', 'DESC']];
      }

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Query needs
      const { count, rows: needs } = await Need.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'asker',
            attributes: ['id', 'fullName', 'avatarUrl', 'rating', 'totalRatings']
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon']
          }
        ],
        order,
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      res.status(200).json({
        status: 'success',
        data: {
          needs,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages,
            hasNext,
            hasPrev
          }
        }
      });
    } catch (error) {
      console.error('Get all needs error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch needs.'
      });
    }
  },

  // Get single need
  getNeed: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const need = await Need.findByPk(id, {
        include: [
          {
            model: User,
            as: 'asker',
            attributes: ['id', 'fullName', 'avatarUrl', 'rating', 'totalRatings', 'location']
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon']
          }
        ]
      });

      if (!need) {
        return res.status(404).json({
          status: 'error',
          message: 'Need not found.'
        });
      }

      // Increment view count
      await need.incrementViewCount();

      // Check if user has unlocked this need
      let hasUnlocked = false;
      if (userId) {
        const unlock = await Unlock.findOne({
          where: {
            needId: id,
            fulfillerId: userId,
            status: 'completed'
          }
        });
        hasUnlocked = !!unlock;
      }

      // Hide contact details if not unlocked
      const needResponse = need.toJSON();
      if (!hasUnlocked && userId !== need.askerId) {
        needResponse.contactPrefs = []; // Hide contact preferences
        needResponse.asker.phone = null; // Hide phone
        needResponse.asker.email = null; // Hide email
      }

      res.status(200).json({
        status: 'success',
        data: {
          need: needResponse,
          hasUnlocked
        }
      });
    } catch (error) {
      console.error('Get need error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch need.'
      });
    }
  },

  // Update need
  updateNeed: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Find need
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
          message: 'You can only update your own needs.'
        });
      }

      // Check if need can be updated
      if (need.status === 'fulfilled') {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot update a fulfilled need.'
        });
      }

      // Update need
      await need.update(updates);

      // Get updated need with details
      const updatedNeed = await Need.findByPk(id, {
        include: [
          {
            model: User,
            as: 'asker',
            attributes: ['id', 'fullName', 'avatarUrl', 'rating', 'totalRatings']
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon']
          }
        ]
      });

      res.status(200).json({
        status: 'success',
        message: 'Need updated successfully.',
        data: { need: updatedNeed }
      });
    } catch (error) {
      console.error('Update need error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update need.'
      });
    }
  },

  // Delete need
  deleteNeed: async (req, res) => {
    try {
      const { id } = req.params;

      // Find need
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
          message: 'You can only delete your own needs.'
        });
      }

      // Soft delete (change status to cancelled)
      await need.update({ status: 'cancelled' });

      // Notify fulfillers who unlocked this need
      const unlocks = await Unlock.findAll({
        where: { needId: id, status: 'completed' },
        include: [{ model: User, as: 'fulfiller' }]
      });

      for (const unlock of unlocks) {
        await sendEmail({
          to: unlock.fulfiller.email,
          subject: 'Need Cancelled - FulfillME',
          html: `
            <h1>Need Cancelled</h1>
            <p>The need "${need.title}" has been cancelled by the asker.</p>
            <p>Your unlock credit for this need has been refunded to your account.</p>
          `
        });
      }

      // Refund credits to fulfillers
      await Unlock.update(
        { status: 'refunded' },
        { where: { needId: id, status: 'completed' } }
      );

      res.status(200).json({
        status: 'success',
        message: 'Need deleted successfully. Credits have been refunded to fulfillers.'
      });
    } catch (error) {
      console.error('Delete need error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete need.'
      });
    }
  },

  // Mark need as fulfilled
  markAsFulfilled: async (req, res) => {
    try {
      const { id } = req.params;

      // Find need
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
          message: 'You can only mark your own needs as fulfilled.'
        });
      }

      // Update status
      await need.update({ status: 'fulfilled' });

      // Notify fulfillers who unlocked this need
      const unlocks = await Unlock.findAll({
        where: { needId: id, status: 'completed' },
        include: [{ model: User, as: 'fulfiller' }]
      });

      for (const unlock of unlocks) {
        await sendEmail({
          to: unlock.fulfiller.email,
          subject: 'Need Fulfilled - FulfillME',
          html: `
            <h1>Need Fulfilled</h1>
            <p>The need "${need.title}" has been marked as fulfilled by the asker.</p>
            <p>You can now leave a rating for the asker.</p>
          `
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Need marked as fulfilled.'
      });
    } catch (error) {
      console.error('Mark as fulfilled error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mark need as fulfilled.'
      });
    }
  },

  // Extend need expiration
  extendExpiration: async (req, res) => {
    try {
      const { id } = req.params;
      const { days = 7 } = req.body;

      // Find need
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
          message: 'You can only extend your own needs.'
        });
      }

      // Extend expiration
      await need.extendExpiration(parseInt(days));

      res.status(200).json({
        status: 'success',
        message: `Need expiration extended by ${days} days.`
      });
    } catch (error) {
      console.error('Extend expiration error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to extend need expiration.'
      });
    }
  },

  // Get needs by user
  getUserNeeds: async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Build where clause
      const where = { askerId: userId };
      if (status) where.status = status;

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Query needs
      const { count, rows: needs } = await Need.findAndCountAll({
        where,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon']
          },
          {
            model: Unlock,
            as: 'unlocks',
            attributes: ['id', 'created_at'],
            include: [{
              model: User,
              as: 'fulfiller',
              attributes: ['id', 'fullName', 'avatarUrl']
            }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      res.status(200).json({
        status: 'success',
        data: {
          needs,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages,
            hasNext,
            hasPrev
          }
        }
      });
    } catch (error) {
      console.error('Get user needs error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch user needs.'
      });
    }
  }
};

// Helper function to notify matching fulfillers
async function sendMatchingFulfillerNotifications(need) {
  try {
    // Find fulfillers in the same location and category
    const fulfillers = await User.findAll({
      where: {
        userType: 'fulfiller',
        isActive: true,
        location: { [Op.iLike]: `%${need.location.split(',')[0]}%` } // Match city/town
      },
      include: [{
        model: Category,
        as: 'categories',
        where: { id: need.categoryId },
        through: { attributes: [] }
      }],
      limit: 50 // Limit notifications
    });

    // Send notifications
    for (const fulfiller of fulfillers) {
      await sendNotification({
        userId: fulfiller.id,
        type: 'NEW_NEED',
        title: 'New Need in Your Area',
        message: `A new need "${need.title}" has been posted in ${need.location}`,
        data: {
          needId: need.id,
          category: need.category.name,
          budget: need.budget
        }
      });

      // Send email notification
      await sendEmail({
        to: fulfiller.email,
        subject: `New Need in ${need.location} - FulfillME`,
        html: `
          <h1>New Need Available!</h1>
          <h2>${need.title}</h2>
          <p><strong>Location:</strong> ${need.location}</p>
          <p><strong>Budget:</strong> KES ${need.budget}</p>
          <p><strong>Description:</strong> ${need.description.substring(0, 100)}...</p>
          <a href="${process.env.CLIENT_URL}/needs/${need.id}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
            View Need
          </a>
        `
      });
    }
  } catch (error) {
    console.error('Error sending fulfiller notifications:', error);
  }
}

module.exports = needController;