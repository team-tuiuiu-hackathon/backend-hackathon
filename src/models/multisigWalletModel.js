const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Carteira Multisig para PostgreSQL usando Sequelize
 */
const MultisigWallet = sequelize.define('MultisigWallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  walletId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Nome da carteira é obrigatório'
      },
      len: {
        args: [1, 100],
        msg: 'Nome deve ter entre 1 e 100 caracteres'
      }
    }
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Descrição não pode ter mais de 500 caracteres'
      }
    }
  },
  contractAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  threshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Threshold deve ser pelo menos 1'
      }
    }
  },
  participants: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(20, 7),
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Saldo não pode ser negativo'
      }
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'frozen'),
    defaultValue: 'active',
    allowNull: false
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'multisig_wallets',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['contractAddress']
    },
    {
      fields: ['createdBy']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = MultisigWallet;