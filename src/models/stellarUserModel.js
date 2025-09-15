const { DataTypes } = require('sequelize');

// Função para obter a instância do Sequelize correta
const getSequelize = () => {
  // Se estivermos em ambiente de teste, usar o banco de teste
  if (process.env.NODE_ENV === 'test') {
    const { testSequelize } = require('../config/testDatabase');
    return testSequelize;
  }
  // Caso contrário, usar o banco principal
  const { sequelize } = require('../config/database');
  return sequelize;
};

const sequelize = getSequelize();

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