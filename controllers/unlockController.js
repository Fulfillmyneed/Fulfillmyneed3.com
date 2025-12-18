const { Unlock, Need, User } = require('../models');
const mpesaService = require('../utils/mpesaService');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

const unlockController = {
  // Unlock a need (initiate payment)
  unlockNeed: async (req, res) => {
    try {
      const { id: needId } = req.params;
      const { paymentMethod = 'mpesa' } = req.body;

      // Check if user is a fulfiller
      if (req.user.userType !== 'fulfiller') {
        return res.status(403).json({
          status: 'error',
          message: 'Only fulfillers can unlock needs.'
        });
      }

      // Find the need
      const need = await Need.findByPk(needId, {
        include: [{
          model: User,
          as: 'asker',
          attributes: ['id', 'fullName', 'email', 'phone']
        }]
      });

      if (!need) {
        return res.status(404).json({
          status: 'error',
          message: 'Need not found.'
        });
      }

      // Check if need is active
      if (need.status !== 'active') {
        return res.status(400).json({
          status: 'error',
          message: 'This need is no longer available.'
        });
      }

      // Check if need has expired
      if (new Date(need.expiresAt) < new Date()) {
        await need.update({ status: 'expired' });
        return res.status(400).json({
          status: 'error',
          message: 'This need has expired.'
        });
      }

      // Check if user has already unlocked this need
      const existingUnlock = await Unlock.findOne({
        where: {
          needId,
          fulfillerId: req.user.id,
          status: 'completed'
        }
      });

      if (existingUnlock) {
        return res.status(400).json({
          status: 'error',
          message: 'You have already unlocked this need.'
        });
      }

      // Check if user has enough credits
      if (req.user.credits >= 1) {
        // Use credits to unlock
        await req.user.update({ credits: req.user.credits - 1 });
        
        // Create unlock record
        const unlock = await Unlock.create({
          needId,
          fulfillerId: req.user.id,
          amount: 0, // Free with credits
          status: 'completed',
          contactDetailsRevealed: true
        });

        // Increment need unlock count
        await need.incrementUnlockCount();

        // Send contact details to fulfiller
        await sendContactDetails(req.user, need);

        return res.status(200).json({
          status: 'success',
          message: 'Need unlocked successfully using credits.',
          data: { unlock }
        });
      }

      // Proceed with payment
      const unlockAmount = 100; // KSh 100 per unlock

      // Create pending unlock record
      const unlock = await Unlock.create({
        needId,
        fulfillerId: req.user.id,
        amount: unlockAmount,
        status: 'pending'
      });

      if (paymentMethod === 'mpesa') {
        // Initiate M-Pesa payment
        const result = await mpesaService.initiateSTKPush(
          req.user.phone,
          unlockAmount,
          `UNLOCK-${unlock.id}`,
          `Unlock need: ${need.title.substring(0, 50)}`
        );

        if (result.success) {
          // Update unlock with checkout request ID
          await unlock.update({
            transactionId: result.checkoutRequestID
          });

          return res.status(200).json({
            status: 'success',
            message: 'M-Pesa payment initiated. Please check your phone to complete payment.',
            data: {
              unlock,
              mpesaResponse: result.response
            }
          });
        } else {
          await unlock.update({ status: 'failed' });
          return res.status(400).json({
            status: 'error',
            message: result.error || 'Failed to initiate M-Pesa payment.'
          });
        }
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Payment method not supported.'
        });
      }
    } catch (error) {
      console.error('Unlock need error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to unlock need.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Handle M-Pesa callback
  handleMpesaCallback: async (req, res) => {
    try {
      const callbackData = req.body;

      // Process callback
      const result = mpesaService.processCallback(callbackData);

      if (result.success) {
        // Find unlock by checkout request ID
        const unlock = await Unlock.findOne({
          where: { transactionId: result.checkoutRequestID },
          include: [
            {
              model: Need,
              as: 'need',
              include: [{
                model: User,
                as: 'asker',
                attributes: ['id', 'fullName', 'email', 'phone']
              }]
            },
            {
              model: User,
              as: 'fulfiller',
              attributes: ['id', 'fullName', 'email', 'phone']
            }
          ]
        });

        if (unlock) {
          // Update unlock status
          await unlock.update({
            status: 'completed',
            mpesaReceipt: result.mpesaReceiptNumber,
            contactDetailsRevealed: true
          });

          // Increment need unlock count
          await unlock.need.incrementUnlockCount();

          // Send contact details to fulfiller
          await sendContactDetails(unlock.fulfiller, unlock.need);

          // Notify asker
          await sendEmail({
            to: unlock.need.asker.email,
            subject: 'Your Need Has Been Unlocked - FulfillME',
            html: `
              <h1>Your Need Has Been Unlocked!</h1>
              <p>Your need "${unlock.need.title}" has been unlocked by ${unlock.fulfiller.fullName}.</p>
              <p>You should receive a message from them soon.</p>
              <a href="${process.env.CLIENT_URL}/needs/${unlock.needId}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
                View Need
              </a>
            `
          });
        }
      }

      // Always respond with success to M-Pesa
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success'
      });
    } catch (error) {
      console.error('M-Pesa callback error:', error);
      res.status(200).json({
        ResultCode: 1,
        ResultDesc: 'Failed'
      });
    }
  },

  // Check unlock status
  checkUnlockStatus: async (req, res) => {
    try {
      const { id: unlockId } = req.params;

      const unlock = await Unlock.findByPk(unlockId, {
        include: [
          {
            model: Need,
            as: 'need',
            attributes: ['id', 'title', 'status']
          }
        ]
      });

      if (!unlock) {
        return res.status(404).json({
          status: 'error',
          message: 'Unlock not found.'
        });
      }

      // Check if user owns the unlock
      if (unlock.fulfillerId !== req.user.id) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only check your own unlocks.'
        });
      }

      // If pending, check M-Pesa status
      if (unlock.status === 'pending' && unlock.transactionId) {
        const result = await mpesaService.checkSTKPushStatus(unlock.transactionId);
        
        if (result.success && result.resultCode === '0') {
          await unlock.update({ status: 'completed' });
        } else if (result.success && result.resultCode !== '0') {
          await unlock.update({ status: 'failed' });
        }
      }

      res.status(200).json({
        status: 'success',
        data: { unlock }
      });
    } catch (error) {
      console.error('Check unlock status error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to check unlock status.'
      });
    }
  },

  // Get user's unlocks
  getUserUnlocks: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const userId = req.params.userId || req.user.id;

      // Build where clause
      const where = { fulfillerId: userId };
      if (status) where.status = status;

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Query unlocks
      const { count, rows: unlocks } = await Unlock.findAndCountAll({
        where,
        include: [
          {
            model: Need,
            as: 'need',
            attributes: ['id', 'title', 'description', 'budget', 'location', 'status'],
            include: [{
              model: User,
              as: 'asker',
              attributes: ['id', 'fullName', 'avatarUrl', 'rating']
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
          unlocks,
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
      console.error('Get user unlocks error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch unlocks.'
      });
    }
  },

  // Purchase credits
  purchaseCredits: async (req, res) => {
    try {
      const { credits = 1, paymentMethod = 'mpesa' } = req.body;
      
      // Calculate amount (KSh 100 per credit)
      const amount = credits * 100;

      // Create credit purchase record
      const purchase = await CreditPurchase.create({
        userId: req.user.id,
        amount,
        credits,
        status: 'pending'
      });

      if (paymentMethod === 'mpesa') {
        // Initiate M-Pesa payment
        const result = await mpesaService.initiateSTKPush(
          req.user.phone,
          amount,
          `CREDITS-${purchase.id}`,
          `Purchase ${credits} credit${credits > 1 ? 's' : ''} on FulfillME`
        );

        if (result.success) {
          // Update purchase with checkout request ID
          await purchase.update({
            transactionId: result.checkoutRequestID
          });

          return res.status(200).json({
            status: 'success',
            message: 'M-Pesa payment initiated. Please check your phone to complete payment.',
            data: {
              purchase,
              mpesaResponse: result.response
            }
          });
        } else {
          await purchase.update({ status: 'failed' });
          return res.status(400).json({
            status: 'error',
            message: result.error || 'Failed to initiate M-Pesa payment.'
          });
        }
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Payment method not supported.'
        });
      }
    } catch (error) {
      console.error('Purchase credits error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to purchase credits.'
      });
    }
  },

  // Get user credits
  getUserCredits: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'credits']
      });

      // Get recent credit purchases
      const purchases = await CreditPurchase.findAll({
        where: { userId: req.user.id },
        order: [['created_at', 'DESC']],
        limit: 10
      });

      res.status(200).json({
        status: 'success',
        data: {
          credits: user.credits,
          purchases
        }
      });
    } catch (error) {
      console.error('Get user credits error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch credits.'
      });
    }
  }
};

// Helper function to send contact details
async function sendContactDetails(fulfiller, need) {
  try {
    // Send email with contact details
    await sendEmail({
      to: fulfiller.email,
      subject: `Contact Details for Need: ${need.title}`,
      html: `
        <h1>Contact Details Unlocked!</h1>
        <h2>${need.title}</h2>
        <p><strong>Asker:</strong> ${need.asker.fullName}</p>
        <p><strong>Location:</strong> ${need.location}</p>
        <p><strong>Budget:</strong> KES ${need.budget}</p>
        <p><strong>Preferred Contact Methods:</strong> ${need.contactPrefs.join(', ')}</p>
        
        <h3>Contact Information:</h3>
        <p><strong>Phone:</strong> ${need.asker.phone}</p>
        <p><strong>Email:</strong> ${need.asker.email}</p>
        
        <h3>How to proceed:</h3>
        <ol>
          <li>Contact the asker using their preferred method</li>
          <li>Discuss the need details</li>
          <li>Agree on terms and timeline</li>
          <li>Fulfill the need as agreed</li>
          <li>Receive payment directly from the asker</li>
        </ol>
        
        <p><strong>Remember:</strong> All payments happen directly between you and the asker.</p>
        
        <a href="${process.env.CLIENT_URL}/needs/${need.id}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
          View Need Details
        </a>
      `
    });

    // Send SMS with basic contact info
    await sendSMS({
      to: fulfiller.phone,
      message: `FulfillME: You unlocked ${need.asker.fullName}'s need "${need.title}". Contact: ${need.asker.phone}. Check email for full details.`
    });

    // Send notification to asker
    await sendEmail({
      to: need.asker.email,
      subject: 'Someone Unlocked Your Need!',
      html: `
        <h1>Your Need Was Unlocked!</h1>
        <p>${fulfiller.fullName} has unlocked your need "${need.title}".</p>
        <p>They should contact you soon using your preferred contact method.</p>
        <p>You can also message them through the FulfillME platform.</p>
        
        <a href="${process.env.CLIENT_URL}/messages?need=${need.id}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
          Send Message
        </a>
      `
    });
  } catch (error) {
    console.error('Error sending contact details:', error);
  }
}

module.exports = unlockController;