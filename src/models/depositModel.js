const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Depósito para PostgreSQL usando Sequelize
 */
const Deposit = sequelize.define('Deposit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  depositId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  walletId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'multisig_wallets',
      key: 'id'
    }
  },
  fromAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(20, 7),
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Valor deve ser positivo'
      }
    }
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USDC',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'processed', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  },
  txHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  confirmations: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  requiredConfirmations: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    allowNull: false
  },
  memo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  detectedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'deposits',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['txHash']
    },
    {
      fields: ['fromAddress']
    },
    {
      fields: ['detectedAt']
    }
  ]
});

module.exports = Deposit;