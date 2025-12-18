const { sequelize } = require('../config/database');
const User = require('./User');
const Need = require('./Need');
const Category = require('./Category');
const Unlock = require('./Unlock');
const Message = require('./Message');
const Rating = require('./Rating');
const Notification = require('./Notification');
const CreditPurchase = require('./CreditPurchase');

// Define associations

// User associations
User.hasMany(Need, { foreignKey: 'askerId', as: 'needs' });
User.hasMany(Unlock, { foreignKey: 'fulfillerId', as: 'unlocks' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
User.hasMany(Rating, { foreignKey: 'ratedUserId', as: 'ratingsReceived' });
User.hasMany(Rating, { foreignKey: 'raterUserId', as: 'ratingsGiven' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
User.hasMany(CreditPurchase, { foreignKey: 'userId', as: 'creditPurchases' });
User.belongsToMany(Category, {
  through: 'fulfiller_categories',
  as: 'categories',
  foreignKey: 'fulfiller_id',
  otherKey: 'category_id'
});

// Need associations
Need.belongsTo(User, { foreignKey: 'askerId', as: 'asker' });
Need.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Need.hasMany(Unlock, { foreignKey: 'needId', as: 'unlocks' });
Need.hasMany(Message, { foreignKey: 'needId', as: 'messages' });
Need.hasMany(Rating, { foreignKey: 'needId', as: 'ratings' });

// Category associations
Category.hasMany(Need, { foreignKey: 'categoryId', as: 'needs' });
Category.belongsToMany(User, {
  through: 'fulfiller_categories',
  as: 'fulfillers',
  foreignKey: 'category_id',
  otherKey: 'fulfiller_id'
});
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });
Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });

// Unlock associations
Unlock.belongsTo(Need, { foreignKey: 'needId', as: 'need' });
Unlock.belongsTo(User, { foreignKey: 'fulfillerId', as: 'fulfiller' });

// Message associations
Message.belongsTo(Need, { foreignKey: 'needId', as: 'need' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

// Rating associations
Rating.belongsTo(Need, { foreignKey: 'needId', as: 'need' });
Rating.belongsTo(User, { foreignKey: 'ratedUserId', as: 'ratedUser' });
Rating.belongsTo(User, { foreignKey: 'raterUserId', as: 'rater' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// CreditPurchase associations
CreditPurchase.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Need,
  Category,
  Unlock,
  Message,
  Rating,
  Notification,
  CreditPurchase
};
const { sequelize } = require('../config/database');
const User = require('./User');
const Need = require('./Need');
const Category = require('./Category');
const Unlock = require('./Unlock');
const Message = require('./Message');
const Rating = require('./Rating');

// Define associations
User.hasMany(Need, { foreignKey: 'askerId', as: 'needs' });
User.hasMany(Unlock, { foreignKey: 'fulfillerId', as: 'unlocks' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
User.hasMany(Rating, { foreignKey: 'ratedUserId', as: 'ratingsReceived' });
User.hasMany(Rating, { foreignKey: 'raterUserId', as: 'ratingsGiven' });

Need.belongsTo(User, { foreignKey: 'askerId', as: 'asker' });
Need.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Need.hasMany(Unlock, { foreignKey: 'needId', as: 'unlocks' });
Need.hasMany(Message, { foreignKey: 'needId', as: 'messages' });
Need.hasMany(Rating, { foreignKey: 'needId', as: 'ratings' });

Category.hasMany(Need, { foreignKey: 'categoryId', as: 'needs' });
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });
Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });

Unlock.belongsTo(Need, { foreignKey: 'needId', as: 'need' });
Unlock.belongsTo(User, { foreignKey: 'fulfillerId', as: 'fulfiller' });

Message.belongsTo(Need, { foreignKey: 'needId', as: 'need' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

Rating.belongsTo(Need, { foreignKey: 'needId', as: 'need' });
Rating.belongsTo(User, { foreignKey: 'ratedUserId', as: 'ratedUser' });
Rating.belongsTo(User, { foreignKey: 'raterUserId', as: 'rater' });

module.exports = {
  sequelize,
  User,
  Need,
  Category,
  Unlock,
  Message,
  Rating
};