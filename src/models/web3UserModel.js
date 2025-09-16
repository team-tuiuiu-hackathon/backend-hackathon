const { DataTypes } = require('sequelize');
const crypto = require('crypto');

// Função para obter a instância do Sequelize correta
const getSequelize = () => {
  try {
    // Se estivermos em ambiente de teste, usar o banco de teste
    if (process.env.NODE_ENV === 'test') {
      const { testSequelize } = require('../config/testDatabase');
      return testSequelize;
    }
    // Caso contrário, usar o banco principal
    const { sequelize } = require('../config/database');
    return sequelize;
  } catch (error) {
    console.warn('Erro ao conectar com o banco de dados:', error.message);
    // Retorna null se não conseguir conectar
    return null;
  }
};

const sequelize = getSequelize();

// Se não conseguir conectar com o banco, retorna um modelo mock
if (!sequelize) {
  console.warn('Usando modelo Web3User mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1)
  };
  return;
}

/**
 * Modelo de Usuário Web3 para autenticação via carteira blockchain
 * Armazena endereços de carteira, nonces e dados de autenticação
 */
const Web3User = sequelize.define('Web3User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único do usuário Web3 (chave primária)'
  },
  walletAddress: {
    type: DataTypes.STRING(42),
    allowNull: false,
    unique: {
      name: 'unique_wallet_address',
      msg: 'Este endereço de carteira já está cadastrado'
    },
    validate: {
      notEmpty: {
        msg: 'Endereço da carteira é obrigatório'
      },
      isEthereumAddress(value) {
        // Validação básica para endereço Ethereum (0x + 40 caracteres hexadecimais)
        const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!ethAddressRegex.test(value)) {
          throw new Error('Endereço da carteira deve ser um endereço Ethereum válido');
        }
      }
    },
    comment: 'Endereço único da carteira Web3 (formato Ethereum)'
  },
  nonce: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Nonce único para autenticação (gerado aleatoriamente)'
  },
  nonceExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de expiração do nonce (5 minutos após geração)'
  },
  fullName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: {
        args: [2, 255],
        msg: 'Nome completo deve ter entre 2 e 255 caracteres'
      }
    },
    comment: 'Nome completo do usuário (opcional)'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: {
      name: 'unique_web3_email',
      msg: 'Este email já está cadastrado'
    },
    validate: {
      isEmail: {
        msg: 'Email deve ter um formato válido'
      }
    },
    comment: 'Email do usuário (opcional)'
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'organizer'),
    defaultValue: 'user',
    allowNull: false,
    validate: {
      isIn: {
        args: [['user', 'admin', 'organizer']],
        msg: 'Role deve ser user, admin ou organizer'
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Status ativo do usuário'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data do último login'
  }
}, {
  tableName: 'web3_users',
  timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  paranoid: false, // Não usar soft delete
  indexes: [
    {
      unique: true,
      fields: ['walletAddress'],
      name: 'idx_web3_users_wallet_address'
    },
    {
      unique: true,
      fields: ['email'],
      name: 'idx_web3_users_email',
      where: {
        email: {
          [sequelize.Sequelize.Op.ne]: null
        }
      }
    },
    {
      fields: ['nonce'],
      name: 'idx_web3_users_nonce'
    },
    {
      fields: ['nonceExpiry'],
      name: 'idx_web3_users_nonce_expiry'
    }
  ],
  hooks: {
    // Hook para normalizar endereço da carteira antes de salvar
    beforeSave: async (user) => {
      if (user.walletAddress) {
        user.walletAddress = user.walletAddress.toLowerCase();
      }
    }
  }
});

/**
 * Gera um novo nonce único para o usuário
 * @returns {string} Nonce hexadecimal de 64 caracteres
 */
Web3User.prototype.generateNonce = function() {
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 5); // Expira em 5 minutos
  
  this.nonce = nonce;
  this.nonceExpiry = expiryTime;
  
  return nonce;
};

/**
 * Verifica se o nonce ainda é válido
 * @returns {boolean} True se o nonce é válido e não expirou
 */
Web3User.prototype.isNonceValid = function() {
  if (!this.nonce || !this.nonceExpiry) {
    return false;
  }
  
  return new Date() < this.nonceExpiry;
};

/**
 * Limpa o nonce após uso bem-sucedido
 */
Web3User.prototype.clearNonce = function() {
  this.nonce = null;
  this.nonceExpiry = null;
};

/**
 * Atualiza o último login do usuário
 */
Web3User.prototype.updateLastLogin = function() {
  this.lastLogin = new Date();
};

/**
 * Método estático para criar ou atualizar usuário Web3
 * @param {string} walletAddress - Endereço da carteira
 * @param {Object} userData - Dados adicionais do usuário (opcional)
 * @returns {Promise<Web3User>} Instância do usuário
 */
Web3User.createOrUpdate = async function(walletAddress, userData = {}) {
  // Se não há conexão com banco, retorna um mock
  if (!sequelize) {
    return {
      id: 'mock-id',
      walletAddress: walletAddress.toLowerCase(),
      nonce: null,
      nonceExpiry: null,
      generateNonce: function() {
        this.nonce = require('crypto').randomBytes(32).toString('hex');
        this.nonceExpiry = new Date(Date.now() + 5 * 60 * 1000);
        return this.nonce;
      },
      save: async function() { return this; }
    };
  }

  const normalizedAddress = walletAddress.toLowerCase();
  
  const [user, created] = await Web3User.findOrCreate({
    where: { walletAddress: normalizedAddress },
    defaults: {
      walletAddress: normalizedAddress,
      ...userData
    }
  });
  
  // Se o usuário já existe e há dados para atualizar
  if (!created && Object.keys(userData).length > 0) {
    await user.update(userData);
  }
  
  return user;
};

module.exports = Web3User;