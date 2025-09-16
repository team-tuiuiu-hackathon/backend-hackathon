const { DataTypes } = require('sequelize');
const { initializeSequelize } = require('../config/sequelizeConfig');

const sequelize = initializeSequelize();

// Se não conseguir conectar com o banco, retorna um modelo mock
if (!sequelize) {
  console.warn('Usando modelo StellarValidation mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1),
    findAll: () => Promise.resolve([]),
    validateAddress: () => Promise.resolve({ isValid: true }),
    getCachedValidation: () => Promise.resolve(null)
  };
  return;
}

/**
 * Modelo para cache de validações de endereços Stellar
 * Armazena resultados de validações para otimizar performance
 */
const StellarValidation = sequelize.define('StellarValidation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único da validação (chave primária)'
  },
  address: {
    type: DataTypes.STRING(56),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Endereço Stellar é obrigatório'
      },
      len: {
        args: [56, 56],
        msg: 'Endereço Stellar deve ter exatamente 56 caracteres'
      }
    },
    comment: 'Endereço Stellar validado'
  },
  isValid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    comment: 'Se o endereço tem formato válido'
  },
  exists: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    comment: 'Se a conta existe na rede Stellar'
  },
  accountData: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Dados da conta Stellar (balances, sequence, etc.)'
  },
  network: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: {
        args: [['mainnet', 'testnet']],
        msg: 'Network deve ser mainnet ou testnet'
      }
    },
    comment: 'Rede onde a conta foi encontrada'
  },
  lastValidated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data da última validação'
  },
  validationCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Número de vezes que foi validado'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de erro da última validação (se houver)'
  }
}, {
  tableName: 'stellar_validations',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['address'],
      name: 'idx_stellar_validations_address'
    },
    {
      fields: ['lastValidated'],
      name: 'idx_stellar_validations_last_validated'
    },
    {
      fields: ['isValid', 'exists'],
      name: 'idx_stellar_validations_status'
    }
  ]
});

/**
 * Busca validação por endereço
 */
StellarValidation.findByAddress = async function(address) {
  return await this.findOne({ where: { address } });
};

/**
 * Cria ou atualiza uma validação
 */
StellarValidation.createOrUpdate = async function(validationData) {
  const existing = await this.findByAddress(validationData.address);
  
  if (existing) {
    // Atualiza registro existente
    await existing.update({
      ...validationData,
      lastValidated: new Date(),
      validationCount: existing.validationCount + 1
    });
    return existing;
  } else {
    // Cria novo registro
    return await this.create(validationData);
  }
};

/**
 * Verifica se uma validação está expirada (mais de 1 hora)
 */
StellarValidation.prototype.isExpired = function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.lastValidated < oneHourAgo;
};

/**
 * Remove validações antigas (mais de 24 horas)
 */
StellarValidation.cleanupOldValidations = async function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deleted = await this.destroy({
    where: {
      lastValidated: {
        [require('sequelize').Op.lt]: oneDayAgo
      }
    }
  });
  console.log(`Removidas ${deleted} validações antigas`);
  return deleted;
};

module.exports = StellarValidation;