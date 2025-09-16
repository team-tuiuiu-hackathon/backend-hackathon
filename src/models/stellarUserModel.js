const { DataTypes } = require('sequelize');

const getSequelize = () => {
  try {
    const { sequelize } = require('../config/database');
    return sequelize;
  } catch (error) {
    console.warn('Erro ao conectar com o banco de dados:', error.message);
    return null;
  }
};

const sequelize = getSequelize();

// Se não conseguir conectar com o banco, retorna um modelo mock
if (!sequelize) {
  console.warn('Usando modelo StellarUser mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1),
    findByAddress: async function(address) {
      return null;
    },
    createOrUpdateWithChallenge: async function(address, challenge) {
      return {
        id: 'mock-id',
        address: address,
        challenge: challenge,
        challengeExpiry: new Date(Date.now() + 5 * 60 * 1000),
        save: async function() { return this; },
        isChallengeValid: function() { return true; },
        clearChallenge: function() { 
          this.challenge = null; 
          this.challengeExpiry = null; 
        },
        updateLastLogin: function() { this.lastLogin = new Date(); }
      };
    }
  };
  return;
}

/**
 * Modelo de Usuário Stellar para autenticação Sign-In with Stellar
 * Armazena a chave pública Stellar e o challenge para autenticação
 */
const StellarUser = sequelize.define('StellarUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único do usuário Stellar (chave primária)'
  },
  address: {
    type: DataTypes.STRING(56),
    allowNull: false,
    unique: {
      name: 'unique_stellar_address',
      msg: 'Este endereço Stellar já está cadastrado'
    },
    validate: {
      notEmpty: {
        msg: 'Endereço Stellar é obrigatório'
      },
      len: {
        args: [56, 56],
        msg: 'Endereço Stellar deve ter exatamente 56 caracteres'
      },
      isValidStellarAddress(value) {
        // Validação básica para chave pública Stellar (começa com G)
        if (!value.startsWith('G')) {
          throw new Error('Endereço Stellar deve começar com G');
        }
      }
    },
    comment: 'Chave pública Stellar do usuário (56 caracteres)'
  },
  challenge: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Challenge deve ter no máximo 1000 caracteres'
      }
    },
    comment: 'Challenge (nonce) para autenticação - limpo após uso'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data do último login bem-sucedido'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Status ativo do usuário'
  }
}, {
  tableName: 'stellar_users',
  timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  paranoid: false, // Não usar soft delete
  indexes: [
    {
      unique: true,
      fields: ['address'],
      name: 'idx_stellar_users_address'
    },
    {
      fields: ['challenge'],
      name: 'idx_stellar_users_challenge'
    },
    {
      fields: ['lastLogin'],
      name: 'idx_stellar_users_last_login'
    }
  ]
});

/**
 * Método para limpar o challenge após uso
 */
StellarUser.prototype.clearChallenge = async function() {
  this.challenge = null;
  await this.save();
};

/**
 * Método para atualizar último login
 */
StellarUser.prototype.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

/**
 * Método estático para encontrar usuário por endereço
 */
StellarUser.findByAddress = async function(address) {
  return await this.findOne({ where: { address } });
};

/**
 * Método estático para criar ou atualizar usuário com challenge
 */
StellarUser.createOrUpdateWithChallenge = async function(address, challenge) {
  const [user, created] = await this.findOrCreate({
    where: { address },
    defaults: { address, challenge }
  });
  
  if (!created) {
    user.challenge = challenge;
    await user.save();
  }
  
  return user;
};

module.exports = StellarUser;