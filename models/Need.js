const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Need = sequelize.define('Need', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'KES'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8)
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8)
  },
  timeline: {
    type: DataTypes.STRING(50)
  },
  photoUrls: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'photo_urls'
  },
  contactPrefs: {
    type: DataTypes.JSONB,
    defaultValue: ['whatsapp', 'call'],
    field: 'contact_prefs'
  },
  status: {
    type: DataTypes.ENUM('active', 'fulfilled', 'expired', 'cancelled'),
    defaultValue: 'active'
  },
  askerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'asker_id'
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'category_id'
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'view_count'
  },
  unlockCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'unlock_count'
  },
  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at'
  }
}, {
  tableName: 'needs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (need) => {
      if (!need.expiresAt) {
        // Default expiration: 30 days from creation
        need.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    }
  }
});

// Instance methods
Need.prototype.incrementViewCount = async function() {
  this.viewCount += 1;
  await this.save();
};

Need.prototype.incrementUnlockCount = async function() {
  this.unlockCount += 1;
  await this.save();
};

Need.prototype.markAsFulfilled = async function() {
  this.status = 'fulfilled';
  await this.save();
};

Need.prototype.extendExpiration = async function(days = 7) {
  this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  this.status = 'active';
  await this.save();
};

// Static methods
Need.findActive = async function(options = {}) {
  return await this.findAll({
    where: {
      status: 'active',
      expiresAt: { [sequelize.Op.gt]: new Date() }
    },
    ...options
  });
};

Need.findByUser = async function(userId, options = {}) {
  return await this.findAll({
    where: { askerId: userId },
    ...options
  });
};

Need.search = async function(searchTerm, filters = {}) {
  const where = {
    status: 'active',
    expiresAt: { [sequelize.Op.gt]: new Date() }
  };

  if (searchTerm) {
    where[sequelize.Op.or] = [
      { title: { [sequelize.Op.iLike]: `%${searchTerm}%` } },
      { description: { [sequelize.Op.iLike]: `%${searchTerm}%` } },
      { location: { [sequelize.Op.iLike]: `%${searchTerm}%` } }
    ];
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.minBudget) {
    where.budget = { [sequelize.Op.gte]: filters.minBudget };
  }

  if (filters.maxBudget) {
    where.budget = { ...where.budget, [sequelize.Op.lte]: filters.maxBudget };
  }

  if (filters.location) {
    where.location = { [sequelize.Op.iLike]: `%${filters.location}%` };
  }

  return await this.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: filters.limit || 50,
    offset: filters.offset || 0
  });
};

module.exports = Need;