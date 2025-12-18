const { Rating, Need, User, Unlock } = require('../models');

const ratingController = {
  // Create rating
  createRating: async (req, res) => {
    try {
      const { id: needId } = req.params;
      const { rating, review } = req.body;

      // Check if need exists and is fulfilled
      const need = await Need.findByPk(needId);
      if (!need) {
        return res.status(404).json({
          status: 'error',
          message: 'Need not found.'
        });
      }

      if (need.status !== 'fulfilled') {
        return res.status(400).json({
          status: 'error',
          message: 'You can only rate fulfilled needs.'
        });
      }

      // Check if user is involved in the need
      let ratedUserId;
      if (req.user.id === need.askerId) {
        // Asker is rating the fulfiller
        const unlock = await Unlock.findOne({
          where: {
            needId,
            status: 'completed'
          }
        });
        if (!unlock) {
          return res.status(400).json({
            status: 'error',
            message: 'No fulfiller found for this need.'
          });
        }
        ratedUserId = unlock.fulfillerId;
      } else {
        // Check if user is a fulfiller of this need
        const unlock = await Unlock.findOne({
          where: {
            needId,
            fulfillerId: req.user.id,
            status: 'completed'
          }
        });
        if (!unlock) {
          return res.status(403).json({
            status: 'error',
            message: 'You are not involved in this need.'
          });
        }
        ratedUserId = need.askerId;
      }

      // Check if already rated
      const existingRating = await Rating.findOne({
        where: {
          needId,
          raterUserId: req.user.id
        }
      });

      if (existingRating) {
        return res.status(400).json({
          status: 'error',
          message: 'You have already rated this need.'
        });
      }

      // Create rating
      const newRating = await Rating.create({
        needId,
        ratedUserId,
        raterUserId: req.user.id,
        rating,
        review
      });

      // Get rating with user details
      const ratingWithDetails = await Rating.findByPk(newRating.id, {
        include: [
          {
            model: User,
            as: 'rater',
            attributes: ['id', 'fullName', 'avatarUrl']
          },
          {
            model: User,
            as: 'rated',
            attributes: ['id', 'fullName', 'avatarUrl']
          }
        ]
      });

      res.status(201).json({
        status: 'success',
        message: 'Rating submitted successfully.',
        data: { rating: ratingWithDetails }
      });
    } catch (error) {
      console.error('Create rating error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to submit rating.'
      });
    }
  },

  // Get ratings for a user
  getUserRatings: async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows: ratings } = await Rating.findAndCountAll({
        where: {
          ratedUserId: userId,
          isPublic: true
        },
        include: [
          {
            model: User,
            as: 'rater',
            attributes: ['id', 'fullName', 'avatarUrl']
          },
          {
            model: Need,
            as: 'need',
            attributes: ['id', 'title']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      res.status(200).json({
        status: 'success',
        data: {
          ratings,
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
      console.error('Get user ratings error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch ratings.'
      });
    }
  }
};

module.exports = ratingController;