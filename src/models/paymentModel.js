const { DataTypes } = require('sequelize');
const { initializeSequelize } = require('../config/sequelizeConfig');

const sequelize = initializeSequelize();

// Se não conseguir conectar com o banco, retorna um modelo mock
if (!sequelize) {
  console.warn('Usando modelo Payment mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1),
    findAll: () => Promise.resolve([])
  };
  return;
}

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
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: {
        args: [['prize', 'sponsorship', 'fee', 'refund', 'other']],
        msg: 'Tipo deve ser prize, sponsorship, fee, refund ou other'
      }
    }
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: {
        args: [['pending', 'processing', 'completed', 'failed', 'cancelled']],
        msg: 'Status deve ser pending, processing, completed, failed ou cancelled'
      }
    }
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