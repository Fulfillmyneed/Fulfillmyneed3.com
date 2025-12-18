const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Unlock = sequelize.define('Unlock', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  needId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'need_id'
  },
  fulfillerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'fulfiller_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING(100),
    unique: true,
    field: 'transaction_id'
  },
  mpesaReceipt: {
    type: DataTypes.STRING(50),
    field: 'mpesa_receipt'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  contactDetailsRevealed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'contact_details_revealed'
  },
  unlockedAt: {
    type: DataTypes.DATE,
    field: 'unlocked_at'
  },
  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at'
  }
}, {
  tableName: 'unlocks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = Unlock;