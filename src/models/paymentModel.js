const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Pagamento para PostgreSQL usando Sequelize
 */
const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  paymentId: {
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
  hackathonId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'hackathons',
      key: 'id'
    }
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
  type: {
    type: DataTypes.ENUM('prize', 'sponsorship', 'fee', 'refund', 'other'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recipient: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  txHash: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  gasUsed: {
    type: DataTypes.DECIMAL(20, 0),
    allowNull: true
  },
  fee: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'payments',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['hackathonId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['type']
    },
    {
      fields: ['createdBy']
    },
    {
      fields: ['txHash']
    }
  ]
});

module.exports = Payment;