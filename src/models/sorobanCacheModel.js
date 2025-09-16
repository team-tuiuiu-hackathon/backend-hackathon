const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo para cache de chamadas do SorobanService
 * Armazena resultados de chamadas para contratos Soroban
 */
const SorobanCache = sequelize.define('SorobanCache', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único do cache (chave primária)'
  },
  contractAddress: {
    type: DataTypes.STRING(56),
    allowNull: false,
    field: 'contract_address',
    validate: {
      notEmpty: {
        msg: 'Endereço do contrato é obrigatório'
      }
    },
    comment: 'Endereço do contrato Soroban'
  },
  methodName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'method_name',
    validate: {
      notEmpty: {
        msg: 'Nome do método é obrigatório'
      }
    },
    comment: 'Nome do método chamado'
  },
  parametersHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'parameters_hash',
    comment: 'Hash dos parâmetros para identificação única'
  },
  resultData: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'result_data',
    comment: 'Resultado da chamada do contrato'
  },
  network: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'mainnet',
    validate: {
      isIn: {
        args: [['mainnet', 'testnet']],
        msg: 'Network deve ser mainnet ou testnet'
      }
    },
    comment: 'Rede Stellar utilizada'
  },
  cachedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'cached_at',
    comment: 'Data do cache'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
    comment: 'Data de expiração do cache'
  },
  hitCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'hit_count',
    comment: 'Número de vezes que foi usado do cache'
  }
}, {
  tableName: 'soroban_cache',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['contract_address', 'method_name', 'parameters_hash', 'network'],
      name: 'idx_soroban_cache_unique'
    },
    {
      fields: ['contract_address'],
      name: 'idx_soroban_cache_contract'
    },
    {
      fields: ['method_name'],
      name: 'idx_soroban_cache_method'
    },
    {
      fields: ['expires_at'],
      name: 'idx_soroban_cache_expires'
    },
    {
      fields: ['network'],
      name: 'idx_soroban_cache_network'
    }
  ]
});

/**
 * Gera hash dos parâmetros para cache
 */
SorobanCache.generateParametersHash = function(parameters) {
  const crypto = require('crypto');
  const paramString = JSON.stringify(parameters, Object.keys(parameters).sort());
  return crypto.createHash('sha256').update(paramString).digest('hex');
};

/**
 * Busca cache por contrato, método e parâmetros
 */
SorobanCache.findCached = async function(contractAddress, methodName, parameters, network = 'mainnet') {
  const parametersHash = this.generateParametersHash(parameters);
  
  const cached = await this.findOne({
    where: {
      contractAddress,
      methodName,
      parametersHash,
      network
    }
  });

  // Verifica se não expirou
  if (cached && cached.expiresAt > new Date()) {
    // Incrementa contador de hits
    await cached.increment('hitCount');
    return cached;
  }

  // Remove cache expirado
  if (cached) {
    await cached.destroy();
  }

  return null;
};

/**
 * Cria ou atualiza cache
 */
SorobanCache.createCache = async function(contractAddress, methodName, parameters, resultData, network = 'mainnet', ttlMinutes = 60) {
  const parametersHash = this.generateParametersHash(parameters);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Remove cache existente se houver
  await this.destroy({
    where: {
      contractAddress,
      methodName,
      parametersHash,
      network
    }
  });

  // Cria novo cache
  return await this.create({
    contractAddress,
    methodName,
    parametersHash,
    resultData,
    network,
    expiresAt
  });
};

/**
 * Remove cache expirado
 */
SorobanCache.cleanupExpired = async function() {
  const deleted = await this.destroy({
    where: {
      expiresAt: {
        [require('sequelize').Op.lt]: new Date()
      }
    }
  });
  console.log(`Removidos ${deleted} caches expirados do Soroban`);
  return deleted;
};

/**
 * Obtém estatísticas do cache
 */
SorobanCache.getStatistics = async function() {
  const { Op } = require('sequelize');
  const now = new Date();
  
  const [total, expired, byNetwork] = await Promise.all([
    this.count(),
    this.count({ where: { expiresAt: { [Op.lt]: now } } }),
    this.findAll({
      attributes: [
        'network',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('hit_count')), 'totalHits']
      ],
      group: ['network'],
      raw: true
    })
  ]);

  return {
    totalEntries: total,
    expiredEntries: expired,
    activeEntries: total - expired,
    byNetwork: byNetwork.reduce((acc, item) => {
      acc[item.network] = {
        count: parseInt(item.count),
        totalHits: parseInt(item.totalHits || 0)
      };
      return acc;
    }, {})
  };
};

module.exports = SorobanCache;