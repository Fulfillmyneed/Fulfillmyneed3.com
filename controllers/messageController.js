const { Message, User, Need, Unlock } = require('../models');
const { sequelize } = require('../config/database');

const messageController = {
  // Send message
  sendMessage: async (req, res) => {
    try {
      const { id: needId } = req.params;
      const { message } = req.body;

      // Check if need exists
      const need = await Need.findByPk(needId, {
        include: [{ model: User, as: 'asker' }]
      });

      if (!need) {
        return res.status(404).json({
          status: 'error',
          message: 'Need not found.'
        });
      }

      // Check if user has unlocked this need or is the asker
      const hasUnlocked = await Unlock.findOne({
        where: {
          needId,
          fulfillerId: req.user.id,
          status: 'completed'
        }
      });

      if (req.user.id !== need.askerId && !hasUnlocked) {
        return res.status(403).json({
          status: 'error',
          message: 'You must unlock this need to send a message.'
        });
      }

      // Determine receiver
      const receiverId = req.user.id === need.askerId ? 
        (hasUnlocked ? hasUnlocked.fulfillerId : null) : need.askerId;

      if (!receiverId) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot determine message receiver.'
        });
      }

      // Create message
      const newMessage = await Message.create({
        needId,
        senderId: req.user.id,
        receiverId,
        message
      });

      // Get message with sender details
      const messageWithDetails = await Message.findByPk(newMessage.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'fullName', 'avatarUrl']
          }
        ]
      });

      res.status(201).json({
        status: 'success',
        message: 'Message sent successfully.',
        data: { message: messageWithDetails }
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to send message.'
      });
    }
  },

  // Get conversation for a need
  getConversation: async (req, res) => {
    try {
      const { id: needId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Check if user is part of the conversation
      const need = await Need.findByPk(needId);
      if (!need) {
        return res.status(404).json({
          status: 'error',
          message: 'Need not found.'
        });
      }

      const hasUnlocked = await Unlock.findOne({
        where: {
          needId,
          fulfillerId: req.user.id,
          status: 'completed'
        }
      });

      if (req.user.id !== need.askerId && !hasUnlocked) {
        return res.status(403).json({
          status: 'error',
          message: 'You are not part of this conversation.'
        });
      }

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get messages
      const { count, rows: messages } = await Message.findAndCountAll({
        where: { needId },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'fullName', 'avatarUrl']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'fullName', 'avatarUrl']
          }
        ],
        order: [['created_at', 'ASC']],
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
          messages,
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
      console.error('Get conversation error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch conversation.'
      });
    }
  },

  // Get user's conversations
  getUserConversations: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get unique needs that user has conversations about
      const needs = await Need.findAll({
        where: {
          [sequelize.Op.or]: [
            { askerId: req.user.id },
            { '$unlocks.fulfiller_id$': req.user.id }
          ]
        },
        include: [
          {
            model: Unlock,
            as: 'unlocks',
            where: { fulfillerId: req.user.id, status: 'completed' },
            required: false
          },
          {
            model: Message,
            as: 'messages',
            attributes: [],
            required: true
          }
        ],
        group: ['Need.id'],
        order: [[sequelize.literal('(SELECT MAX(created_at) FROM messages WHERE messages.need_id = Need.id)'), 'DESC']],
        limit: parseInt(limit),
        offset
      });

      // Get last message for each need
      const conversations = await Promise.all(
        needs.map(async (need) => {
          const lastMessage = await Message.findOne({
            where: { needId: need.id },
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'fullName', 'avatarUrl']
              }
            ],
            order: [['created_at', 'DESC']]
          });

          return {
            need: {
              id: need.id,
              title: need.title,
              status: need.status
            },
            lastMessage
          };
        })
      );

      res.status(200).json({
        status: 'success',
        data: { conversations }
      });
    } catch (error) {
      console.error('Get user conversations error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch conversations.'
      });
    }
  }
};

module.exports = messageController;