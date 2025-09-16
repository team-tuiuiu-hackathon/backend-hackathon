const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo para estatísticas de uso dos serviços
 * Rastreia métricas de performance e uso
 */
const ServiceStatistics = sequelize.define('ServiceStatistics', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único da estatística (chave primária)'
  },
  serviceName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'service_name',
    validate: {
      notEmpty: {
        msg: 'Nome do serviço é obrigatório'
      }
    },
    comment: 'Nome do serviço'
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
    comment: 'Nome do método'
  },
  callCount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'call_count',
    comment: 'Número total de chamadas'
  },
  successCount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'success_count',
    comment: 'Número de chamadas bem-sucedidas'
  },
  errorCount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'error_count',
    comment: 'Número de chamadas com erro'
  },
  cacheHitCount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'cache_hit_count',
    comment: 'Número de hits no cache'
  },
  cacheMissCount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'cache_miss_count',
    comment: 'Número de misses no cache'
  },
  totalExecutionTime: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'total_execution_time',
    comment: 'Tempo total de execução em milissegundos'
  },
  minExecutionTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'min_execution_time',
    comment: 'Tempo mínimo de execução em milissegundos'
  },
  maxExecutionTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'max_execution_time',
    comment: 'Tempo máximo de execução em milissegundos'
  },
  lastCallAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_call_at',
    comment: 'Data da última chamada'
  },
  lastErrorAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_error_at',
    comment: 'Data do último erro'
  },
  lastErrorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_error_message',
    comment: 'Mensagem do último erro'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Metadados adicionais'
  }
}, {
  tableName: 'service_statistics',
  timestamps: true,
  indexes: [
    {
      fields: ['service_name', 'method_name'],
      unique: true,
      name: 'idx_service_statistics_unique'
    },
    {
      fields: ['service_name'],
      name: 'idx_service_statistics_service'
    },
    {
      fields: ['last_call_at'],
      name: 'idx_service_statistics_last_call'
    }
  ]
});

/**
 * Registra uma chamada de método
 */
ServiceStatistics.recordCall = async function(serviceName, methodName, executionTime, success = true, errorMessage = null) {
  const now = new Date();
  
  const [stats, created] = await this.findOrCreate({
    where: {
      serviceName,
      methodName
    },
    defaults: {
      serviceName,
      methodName,
      callCount: 1,
      successCount: success ? 1 : 0,
      errorCount: success ? 0 : 1,
      totalExecutionTime: executionTime,
      minExecutionTime: executionTime,
      maxExecutionTime: executionTime,
      lastCallAt: now,
      lastErrorAt: success ? null : now,
      lastErrorMessage: errorMessage
    }
  });

  if (!created) {
    const updates = {
      callCount: stats.callCount + 1,
      successCount: stats.successCount + (success ? 1 : 0),
      errorCount: stats.errorCount + (success ? 0 : 1),
      totalExecutionTime: stats.totalExecutionTime + executionTime,
      minExecutionTime: Math.min(stats.minExecutionTime || executionTime, executionTime),
      maxExecutionTime: Math.max(stats.maxExecutionTime || executionTime, executionTime),
      lastCallAt: now
    };

    if (!success) {
      updates.lastErrorAt = now;
      updates.lastErrorMessage = errorMessage;
    }

    await stats.update(updates);
  }

  return stats;
};

/**
 * Registra hit no cache
 */
ServiceStatistics.recordCacheHit = async function(serviceName, methodName) {
  const [stats] = await this.findOrCreate({
    where: {
      serviceName,
      methodName
    },
    defaults: {
      serviceName,
      methodName,
      cacheHitCount: 1
    }
  });

  if (stats.cacheHitCount > 0) {
    await stats.increment('cacheHitCount');
  }

  return stats;
};

/**
 * Registra miss no cache
 */
ServiceStatistics.recordCacheMiss = async function(serviceName, methodName) {
  const [stats] = await this.findOrCreate({
    where: {
      serviceName,
      methodName
    },
    defaults: {
      serviceName,
      methodName,
      cacheMissCount: 1
    }
  });

  if (stats.cacheMissCount > 0) {
    await stats.increment('cacheMissCount');
  }

  return stats;
};

/**
 * Obtém estatísticas de um serviço
 */
ServiceStatistics.getServiceStats = async function(serviceName) {
  const stats = await this.findAll({
    where: {
      serviceName
    },
    order: [['methodName', 'ASC']]
  });

  const summary = stats.reduce((acc, stat) => {
    acc.totalCalls += Number(stat.callCount);
    acc.totalSuccess += Number(stat.successCount);
    acc.totalErrors += Number(stat.errorCount);
    acc.totalCacheHits += Number(stat.cacheHitCount);
    acc.totalCacheMisses += Number(stat.cacheMissCount);
    acc.totalExecutionTime += Number(stat.totalExecutionTime);
    
    if (stat.lastCallAt && (!acc.lastCallAt || stat.lastCallAt > acc.lastCallAt)) {
      acc.lastCallAt = stat.lastCallAt;
    }
    
    return acc;
  }, {
    totalCalls: 0,
    totalSuccess: 0,
    totalErrors: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    totalExecutionTime: 0,
    lastCallAt: null
  });

  return {
    serviceName,
    summary,
    methods: stats.map(stat => ({
      methodName: stat.methodName,
      callCount: Number(stat.callCount),
      successCount: Number(stat.successCount),
      errorCount: Number(stat.errorCount),
      successRate: Number(stat.callCount) > 0 ? 
        (Number(stat.successCount) / Number(stat.callCount) * 100).toFixed(2) + '%' : '0%',
      cacheHitCount: Number(stat.cacheHitCount),
      cacheMissCount: Number(stat.cacheMissCount),
      cacheHitRate: (Number(stat.cacheHitCount) + Number(stat.cacheMissCount)) > 0 ?
        (Number(stat.cacheHitCount) / (Number(stat.cacheHitCount) + Number(stat.cacheMissCount)) * 100).toFixed(2) + '%' : '0%',
      avgExecutionTime: Number(stat.callCount) > 0 ? 
        Math.round(Number(stat.totalExecutionTime) / Number(stat.callCount)) + 'ms' : '0ms',
      minExecutionTime: stat.minExecutionTime ? stat.minExecutionTime + 'ms' : null,
      maxExecutionTime: stat.maxExecutionTime ? stat.maxExecutionTime + 'ms' : null,
      lastCallAt: stat.lastCallAt,
      lastErrorAt: stat.lastErrorAt,
      lastErrorMessage: stat.lastErrorMessage
    }))
  };
};

/**
 * Obtém estatísticas globais
 */
ServiceStatistics.getGlobalStats = async function() {
  const stats = await this.findAll({
    attributes: [
      'service_name',
      [sequelize.fn('SUM', sequelize.col('call_count')), 'totalCalls'],
      [sequelize.fn('SUM', sequelize.col('success_count')), 'totalSuccess'],
      [sequelize.fn('SUM', sequelize.col('error_count')), 'totalErrors'],
      [sequelize.fn('SUM', sequelize.col('cache_hit_count')), 'totalCacheHits'],
      [sequelize.fn('SUM', sequelize.col('cache_miss_count')), 'totalCacheMisses'],
      [sequelize.fn('SUM', sequelize.col('total_execution_time')), 'totalExecutionTime'],
      [sequelize.fn('MAX', sequelize.col('last_call_at')), 'lastCallAt']
    ],
    group: ['service_name'],
    raw: true
  });

  return stats.map(stat => ({
    serviceName: stat.service_name,
    totalCalls: Number(stat.totalCalls),
    totalSuccess: Number(stat.totalSuccess),
    totalErrors: Number(stat.totalErrors),
    successRate: Number(stat.totalCalls) > 0 ? 
      (Number(stat.totalSuccess) / Number(stat.totalCalls) * 100).toFixed(2) + '%' : '0%',
    totalCacheHits: Number(stat.totalCacheHits),
    totalCacheMisses: Number(stat.totalCacheMisses),
    cacheHitRate: (Number(stat.totalCacheHits) + Number(stat.totalCacheMisses)) > 0 ?
      (Number(stat.totalCacheHits) / (Number(stat.totalCacheHits) + Number(stat.totalCacheMisses)) * 100).toFixed(2) + '%' : '0%',
    avgExecutionTime: Number(stat.totalCalls) > 0 ? 
      Math.round(Number(stat.totalExecutionTime) / Number(stat.totalCalls)) + 'ms' : '0ms',
    lastCallAt: stat.lastCallAt
  }));
};

/**
 * Remove estatísticas antigas
 */
ServiceStatistics.cleanupOldStats = async function(daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const deleted = await this.destroy({
    where: {
      lastCallAt: {
        [require('sequelize').Op.lt]: cutoffDate
      }
    }
  });
  
  console.log(`Removidas ${deleted} estatísticas antigas`);
  return deleted;
};

/**
 * Reseta estatísticas de um serviço
 */
ServiceStatistics.resetServiceStats = async function(serviceName, methodName = null) {
  const whereClause = { serviceName };
  if (methodName) {
    whereClause.methodName = methodName;
  }

  const updated = await this.update({
    callCount: 0,
    successCount: 0,
    errorCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    totalExecutionTime: 0,
    minExecutionTime: null,
    maxExecutionTime: null,
    lastCallAt: null,
    lastErrorAt: null,
    lastErrorMessage: null
  }, {
    where: whereClause
  });

  return updated[0]; // Retorna número de registros atualizados
};

module.exports = ServiceStatistics;