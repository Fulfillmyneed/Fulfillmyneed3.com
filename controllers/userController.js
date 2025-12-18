const { User, Need, Rating } = require('../models');

const userController = {
  // Get user profile by ID
  getUserProfile: async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['passwordHash'] },
        include: [
          {
            model: Need,
            as: 'needs',
            limit: 5,
            order: [['created_at', 'DESC']]
          },
          {
            model: Rating,
            as: 'ratingsReceived',
            where: { isPublic: true },
            required: false,
            limit: 10
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      res.status(200).json({
        status: 'success',
        data: { user }
      });
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch user profile.'
      });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const updates = req.body;
      const userId = req.user.id;

      // Remove fields that cannot be updated
      delete updates.email;
      delete updates.phone;
      delete updates.userType;
      delete updates.credits;
      delete updates.rating;

      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      // Update user
      await user.update(updates);

      // Get updated user without sensitive data
      const updatedUser = await User.findByPk(userId, {
        attributes: { exclude: ['passwordHash'] }
      });

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully.',
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update profile.'
      });
    }
  },

  // Change password
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user;

      // Check current password
      const isPasswordCorrect = await user.correctPassword(currentPassword);
      if (!isPasswordCorrect) {
        return res.status(401).json({
          status: 'error',
          message: 'Current password is incorrect.'
        });
      }

      // Update password
      user.passwordHash = newPassword;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully.'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to change password.'
      });
    }
  },

  // Get user statistics
  getUserStats: async (req, res) => {
    try {
      const userId = req.params.userId || req.user.id;

      const [
        needsCount,
        unlocksCount,
        ratingsCount,
        avgRating
      ] = await Promise.all([
        Need.count({ where: { askerId: userId } }),
        Unlock.count({ where: { fulfillerId: userId, status: 'completed' } }),
        Rating.count({ where: { ratedUserId: userId, isPublic: true } }),
        Rating.findOne({
          where: { ratedUserId: userId, isPublic: true },
          attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']]
        })
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          stats: {
            needsCount,
            unlocksCount,
            ratingsCount,
            avgRating: avgRating ? parseFloat(avgRating.get('avgRating')).toFixed(2) : 0
          }
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch user statistics.'
      });
    }
  }
};

module.exports = userController;