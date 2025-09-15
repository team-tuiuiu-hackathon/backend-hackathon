const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Regras de Divisão de Fundos para PostgreSQL usando Sequelize
 */
const FundSplitRule = sequelize.define('FundSplitRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  ruleId: {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  ruleType: {
    type: DataTypes.ENUM('percentage', 'fixed_amount', 'priority_based', 'conditional', 'threshold_based'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
    allowNull: false
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    validate: {
      min: 1,
      max: 100
    }
  },

  conditions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },

  splitConfiguration: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  advancedSettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      allowPartialSplit: false,
      minAmountPerDestination: 0.000001,
      roundAmounts: true,
      decimalPlaces: 6,
      remainderAction: 'keep_in_wallet'
    },
    allowNull: true
  },

  executionHistory: {
    type: DataTypes.JSONB,
    defaultValue: [],
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
  lastModifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  lastExecutedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'fund_split_rules',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['ruleType']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['createdBy']
    },
    {
      fields: ['walletId', 'status', 'priority']
    },
    {
      fields: ['ruleType', 'status']
    },
    {
      fields: ['createdBy', 'createdAt']
    }
  ]
});

module.exports = FundSplitRule;