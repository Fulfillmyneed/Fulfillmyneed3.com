const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const { generateToken, generateRefreshToken } = require('../utils/tokenService');

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        location,
        nationalId,
        gender,
        userType,
        categories,
        password
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [User.sequelize.Op.or]: [{ email }, { phone }]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'User with this email or phone already exists'
        });
      }

      // Create user
      const user = await User.create({
        fullName,
        email,
        phone,
        location,
        nationalId,
        gender,
        userType,
        categories: userType === 'fulfiller' ? categories || [] : [],
        passwordHash: password
      });

      // Generate tokens
      const token = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Send verification email
      const verificationToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - FulfillME',
        html: `
          <h1>Welcome to FulfillME!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can ignore this email.</p>
        `
      });

      // Send welcome SMS
      await sendSMS({
        to: user.phone,
        message: `Welcome to FulfillME! Your account has been created successfully. Please verify your email to get started.`
      });

      // Remove sensitive data from response
      const userResponse = user.toJSON();

      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please check your email for verification.',
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Registration failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      const { email, phone, password } = req.body;

      // Find user by email or phone
      const user = await User.findOne({
        where: {
          [User.sequelize.Op.or]: [
            { email: email || null },
            { phone: phone || null }
          ]
        }
      });

      // Check if user exists
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'Your account has been deactivated. Please contact support.'
        });
      }

      // Check password
      const isPasswordCorrect = await user.correctPassword(password);
      if (!isPasswordCorrect) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const token = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Remove sensitive data from response
      const userResponse = user.toJSON();

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Login failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Refresh token
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Find user
      const user = await User.findByPk(decoded.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive'
        });
      }

      // Generate new tokens
      const newToken = generateToken(user);
      const newRefreshToken = generateRefreshToken(user);

      res.status(200).json({
        status: 'success',
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token has expired. Please log in again.'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Token refresh failed'
      });
    }
  },

  // Forgot password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
        // Don't reveal that user doesn't exist for security
        return res.status(200).json({
          status: 'success',
          message: 'If an account exists with this email, you will receive a password reset link.'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Save reset token and expiration (1 hour)
      user.passwordResetToken = resetTokenHash;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // Send reset email
      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

      await sendEmail({
        to: user.email,
        subject: 'Reset Your Password - FulfillME',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can ignore this email.</p>
        `
      });

      res.status(200).json({
        status: 'success',
        message: 'Password reset link sent to your email.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process password reset request.'
      });
    }
  },

  // Reset password
  resetPassword: async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      // Hash the token
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Find user with valid reset token
      const user = await User.findOne({
        where: {
          passwordResetToken: resetTokenHash,
          passwordResetExpires: { [User.sequelize.Op.gt]: new Date() }
        }
      });

      if (!user) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or expired reset token.'
        });
      }

      // Update password and clear reset token
      user.passwordHash = password;
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      // Send confirmation email
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Successful - FulfillME',
        html: `
          <h1>Password Reset Successful</h1>
          <p>Your password has been successfully reset.</p>
          <p>If you didn't make this change, please contact support immediately.</p>
        `
      });

      res.status(200).json({
        status: 'success',
        message: 'Password reset successful. You can now log in with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to reset password.'
      });
    }
  },

  // Verify email
  verifyEmail: async (req, res) => {
    try {
      const user = req.user; // From verifyEmailToken middleware

      if (user.isVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is already verified.'
        });
      }

      // Mark as verified
      user.isVerified = true;
      await user.save();

      // Send welcome email
      await sendEmail({
        to: user.email,
        subject: 'Email Verified Successfully - FulfillME',
        html: `
          <h1>Email Verified Successfully!</h1>
          <p>Thank you for verifying your email address.</p>
          <p>You can now enjoy all the features of FulfillME.</p>
          ${user.userType === 'fulfiller' ? 
            '<p>As a fulfiller, you can now browse needs and unlock contact information.</p>' : 
            '<p>As an asker, you can now post your needs and get them fulfilled.</p>'}
        `
      });

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully.'
      });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to verify email.'
      });
    }
  },

  // Resend verification email
  resendVerification: async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found.'
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is already verified.'
        });
      }

      // Generate new verification token
      const verificationToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - FulfillME',
        html: `
          <h1>Verify Your Email</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #228B22; color: white; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p>This link will expire in 24 hours.</p>
        `
      });

      res.status(200).json({
        status: 'success',
        message: 'Verification email sent successfully.'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to resend verification email.'
      });
    }
  },

  // Get current user
  getMe: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['passwordHash', 'passwordResetToken', 'passwordResetExpires'] }
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
      console.error('Get me error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get user profile.'
      });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      // In a stateless JWT system, logout is handled on client side
      // But we can blacklist tokens if needed
      
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully.'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to logout.'
      });
    }
  }
};

module.exports = authController;