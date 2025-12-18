const { body, param, query, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
    
    return res.status(422).json({
      status: 'error',
      message: 'Validation failed',
      errors: extractedErrors
    });
  };
};

// Common validation rules
const commonRules = {
  email: body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  phone: body('phone')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter'),
  
  location: body('location')
    .isLength({ min: 3, max: 100 })
    .withMessage('Location must be between 3 and 100 characters'),
  
  name: body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
};

// Auth validation rules
const authValidation = {
  register: validate([
    commonRules.name,
    commonRules.email,
    commonRules.phone,
    commonRules.location,
    commonRules.password,
    body('userType')
      .isIn(['asker', 'fulfiller'])
      .withMessage('User type must be either asker or fulfiller'),
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other'),
    body('nationalId')
      .optional()
      .isLength({ min: 5, max: 20 })
      .withMessage('National ID must be between 5 and 20 characters'),
    body('categories')
      .optional()
      .isArray()
      .withMessage('Categories must be an array')
  ]),
  
  login: validate([
    body('email')
      .if(body('email').exists())
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('phone')
      .if(body('phone').exists())
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]),
  
  forgotPassword: validate([
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
  ]),
  
  resetPassword: validate([
    commonRules.password,
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ])
};

// Need validation rules
const needValidation = {
  createNeed: validate([
    body('title')
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters')
      .trim(),
    body('description')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters')
      .trim(),
    body('budget')
      .isFloat({ min: 0 })
      .withMessage('Budget must be a positive number'),
    commonRules.location,
    body('categoryId')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('timeline')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Timeline must be less than 50 characters'),
    body('contactPrefs')
      .optional()
      .isArray()
      .withMessage('Contact preferences must be an array'),
    body('photoUrls')
      .optional()
      .isArray()
      .withMessage('Photo URLs must be an array'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180')
  ]),
  
  updateNeed: validate([
    body('title')
      .optional()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('description')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('budget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Budget must be a positive number'),
    body('status')
      .optional()
      .isIn(['active', 'fulfilled', 'expired', 'cancelled'])
      .withMessage('Invalid status')
  ]),
  
  needId: validate([
    param('id')
      .isUUID()
      .withMessage('Need ID must be a valid UUID')
  ])
};

// Message validation rules
const messageValidation = {
  sendMessage: validate([
    param('needId')
      .isUUID()
      .withMessage('Need ID must be a valid UUID'),
    body('message')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
      .trim()
  ])
};

// Rating validation rules
const ratingValidation = {
  createRating: validate([
    param('needId')
      .isUUID()
      .withMessage('Need ID must be a valid UUID'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('review')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Review must be less than 500 characters')
  ])
};

// Query validation rules
const queryValidation = {
  pagination: validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('sort')
      .optional()
      .isIn(['newest', 'oldest', 'budget_high', 'budget_low', 'popular'])
      .withMessage('Invalid sort option')
  ]),
  
  search: validate([
    query('q')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Search query must be less than 100 characters'),
    query('category')
      .optional()
      .isUUID()
      .withMessage('Category must be a valid UUID'),
    query('location')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Location must be less than 100 characters'),
    query('minBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum budget must be a positive number'),
    query('maxBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum budget must be a positive number')
  ])
};

module.exports = {
  validate,
  authValidation,
  needValidation,
  messageValidation,
  ratingValidation,
  queryValidation,
  commonRules
};