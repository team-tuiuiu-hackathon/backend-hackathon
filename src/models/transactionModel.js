const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Transação para PostgreSQL usando Sequelize
 */
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  transactionId: {
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
  type: {
    type: DataTypes.ENUM('payment', 'deposit', 'division', 'configuration'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(20, 7),
    allowNull: true,
    validate: {
      min: {
        args: [0],
        msg: 'Valor deve ser positivo'
      }
    }
  },
  currency: {
    type: DataTypes.ENUM('USDC', 'XLM'),
    defaultValue: 'USDC',
    allowNull: true
  },
  recipient: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  sender: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'executed', 'rejected', 'expired'),
    defaultValue: 'pending',
    allowNull: false
  },
  signatures: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  },
  requiredSignatures: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  blockchainData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  proposedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  proposedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  executedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  auditLog: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['type']
    },
    {
      fields: ['proposedBy']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Transaction;