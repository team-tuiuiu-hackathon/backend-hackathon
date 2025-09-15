const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Log de Auditoria para PostgreSQL usando Sequelize
 */
const AuditLog = sequelize.define('AuditLog', {
  // Identificador único do log
  logId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomUUID()
  },

  // Informações temporais
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    immutable: true
  },

  // Informações do evento
  eventType: {
    type: String,
    required: true,
    enum: [
      'user_login',
      'user_logout',
      'user_registration',
      'user_password_change',
      'wallet_creation',
      'wallet_modification',
      'wallet_deletion',
      'transaction_creation',
      'transaction_approval',
      'transaction_execution',
      'transaction_rejection',
      'deposit_received',
      'payment_sent',
      'smart_contract_interaction',
      'fund_split_execution',
      'fund_split_rule_creation',
      'fund_split_rule_modification',
      'fund_split_rule_deletion',
      'access_denied',
      'permission_change',
      'system_error',
      'security_alert',
      'data_export',
      'data_import',
      'backup_creation',
      'backup_restoration',
      'admin_action'
    ],
    immutable: true
  },

  // Categoria do evento para filtragem
  category: {
    type: String,
    required: true,
    enum: ['authentication', 'authorization', 'transaction', 'wallet', 'system', 'security', 'data'],
    immutable: true
  },

  // Nível de severidade
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    immutable: true
  },

  // Informações do usuário (se aplicável)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    immutable: true
  },

  userEmail: {
    type: String,
    immutable: true
  },

  // Informações da sessão
  sessionId: {
    type: String,
    immutable: true
  },

  // Informações de rede
  ipAddress: {
    type: String,
    required: true,
    immutable: true
  },

  userAgent: {
    type: String,
    immutable: true
  },

  // Localização geográfica (se disponível)
  geolocation: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },

  // Recurso afetado
  resourceType: {
    type: String,
    enum: ['user', 'wallet', 'transaction', 'deposit', 'payment', 'smart_contract', 'fund_split_rule', 'system'],
    immutable: true
  },

  resourceId: {
    type: String,
    immutable: true
  },

  // Ação realizada
  action: {
    type: String,
    required: true,
    immutable: true
  },

  // Resultado da ação
  result: {
    type: String,
    required: true,
    enum: ['success', 'failure', 'partial', 'pending'],
    immutable: true
  },

  // Descrição detalhada do evento
  description: {
    type: String,
    required: true,
    maxlength: 1000,
    immutable: true
  },

  // Dados específicos do evento (criptografados)
  eventData: {
    type: String, // JSON criptografado
    immutable: true
  },

  // Dados antes da modificação (para operações de update)
  previousState: {
    type: String, // JSON criptografado
    immutable: true
  },

  // Dados após a modificação
  newState: {
    type: String, // JSON criptografado
    immutable: true
  },

  // Informações de erro (se aplicável)
  errorDetails: {
    code: String,
    message: String,
    stack: String
  },

  // Hash para verificação de integridade
  integrityHash: {
    type: String,
    required: true,
    immutable: true
  },

  // Hash do log anterior (para criar cadeia)
  previousLogHash: {
    type: String,
    immutable: true
  },

  // Assinatura digital do log
  digitalSignature: {
    type: String,
    immutable: true
  },

  // Metadados adicionais
  metadata: {
    applicationVersion: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production'
    },
    correlationId: String, // Para rastrear operações relacionadas
    traceId: String, // Para rastreamento distribuído
    tags: [String] // Tags para categorização adicional
  },

  // Status de retenção
  retentionPolicy: {
    retainUntil: Date,
    archived: {
      type: Boolean,
      default: false
    },
    archiveLocation: String
  },

  // Informações de compliance
  complianceFlags: {
    gdprRelevant: {
      type: Boolean,
      default: false
    },
    pciRelevant: {
      type: Boolean,
      default: false
    },
    soxRelevant: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: false, // Usamos nosso próprio timestamp
  versionKey: false,
  collection: 'audit_logs'
});

// Índices para performance e consultas
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, severity: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ result: 1, timestamp: -1 });
auditLogSchema.index({ 'metadata.correlationId': 1 });
auditLogSchema.index({ 'metadata.traceId': 1 });

// Índice composto para consultas de auditoria
auditLogSchema.index({
  eventType: 1,
  userId: 1,
  timestamp: -1
});

// Índice para compliance
auditLogSchema.index({
  'complianceFlags.gdprRelevant': 1,
  'complianceFlags.pciRelevant': 1,
  timestamp: -1
});

// Virtual para idade do log
auditLogSchema.virtual('age').get(function() {
  return Date.now() - this.timestamp.getTime();
});

// Virtual para verificar se o log está expirado
auditLogSchema.virtual('isExpired').get(function() {
  if (!this.retentionPolicy.retainUntil) return false;
  return new Date() > this.retentionPolicy.retainUntil;
});

// Middleware para prevenir modificações
auditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    const error = new Error('Logs de auditoria são imutáveis e não podem ser modificados');
    error.name = 'ImmutableLogError';
    return next(error);
  }
  next();
});

auditLogSchema.pre('findOneAndUpdate', function(next) {
  const error = new Error('Logs de auditoria são imutáveis e não podem ser modificados');
  error.name = 'ImmutableLogError';
  next(error);
});

auditLogSchema.pre('updateOne', function(next) {
  const error = new Error('Logs de auditoria são imutáveis e não podem ser modificados');
  error.name = 'ImmutableLogError';
  next(error);
});

auditLogSchema.pre('updateMany', function(next) {
  const error = new Error('Logs de auditoria são imutáveis e não podem ser modificados');
  error.name = 'ImmutableLogError';
  next(error);
});

// Middleware para gerar hash de integridade antes de salvar
auditLogSchema.pre('save', function(next) {
  if (this.isNew) {
    this.integrityHash = this.generateIntegrityHash();
  }
  next();
});

// Métodos de instância
auditLogSchema.methods.generateIntegrityHash = function() {
  const data = {
    logId: this.logId,
    timestamp: this.timestamp,
    eventType: this.eventType,
    userId: this.userId,
    ipAddress: this.ipAddress,
    action: this.action,
    result: this.result,
    description: this.description,
    eventData: this.eventData,
    previousLogHash: this.previousLogHash
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
};

auditLogSchema.methods.verifyIntegrity = function() {
  const calculatedHash = this.generateIntegrityHash();
  return calculatedHash === this.integrityHash;
};

auditLogSchema.methods.encryptSensitiveData = function(data, secretKey) {
  if (!data) return null;
  
  const cipher = crypto.createCipher('aes-256-cbc', secretKey);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

auditLogSchema.methods.decryptSensitiveData = function(encryptedData, secretKey) {
  if (!encryptedData) return null;
  
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', secretKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Erro ao descriptografar dados do log:', error);
    return null;
  }
};

// Métodos estáticos
auditLogSchema.statics.createAuditLog = async function(logData) {
  try {
    // Obter o hash do último log para criar cadeia
    const lastLog = await this.findOne({}, {}, { sort: { timestamp: -1 } });
    
    const auditLog = new this({
      ...logData,
      previousLogHash: lastLog ? lastLog.integrityHash : null
    });

    return await auditLog.save();
  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error);
    throw error;
  }
};

auditLogSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.eventType) query.eventType = options.eventType;
  if (options.category) query.category = options.category;
  if (options.severity) query.severity = options.severity;
  if (options.result) query.result = options.result;
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = new Date(options.startDate);
    if (options.endDate) query.timestamp.$lte = new Date(options.endDate);
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

auditLogSchema.statics.findByResource = function(resourceType, resourceId, options = {}) {
  const query = { resourceType, resourceId };
  
  if (options.action) query.action = options.action;
  if (options.result) query.result = options.result;
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = new Date(options.startDate);
    if (options.endDate) query.timestamp.$lte = new Date(options.endDate);
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 50);
};

auditLogSchema.statics.findSecurityEvents = function(options = {}) {
  const query = {
    $or: [
      { category: 'security' },
      { severity: 'critical' },
      { eventType: 'access_denied' },
      { result: 'failure' }
    ]
  };
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = new Date(options.startDate);
    if (options.endDate) query.timestamp.$lte = new Date(options.endDate);
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

auditLogSchema.statics.verifyLogChain = async function(startDate, endDate) {
  const logs = await this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ timestamp: 1 });

  const results = {
    totalLogs: logs.length,
    validLogs: 0,
    invalidLogs: 0,
    brokenChain: false,
    errors: []
  };

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    // Verificar integridade do log individual
    if (!log.verifyIntegrity()) {
      results.invalidLogs++;
      results.errors.push({
        logId: log.logId,
        error: 'Hash de integridade inválido'
      });
      continue;
    }

    // Verificar cadeia de logs
    if (i > 0) {
      const previousLog = logs[i - 1];
      if (log.previousLogHash !== previousLog.integrityHash) {
        results.brokenChain = true;
        results.errors.push({
          logId: log.logId,
          error: 'Cadeia de logs quebrada'
        });
      }
    }

    results.validLogs++;
  }

  return results;
};

auditLogSchema.statics.getStatistics = async function(startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        eventTypes: { $addToSet: '$eventType' },
        categories: { $addToSet: '$category' },
        severityDistribution: {
          $push: '$severity'
        },
        resultDistribution: {
          $push: '$result'
        },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ipAddress' }
      }
    },
    {
      $project: {
        _id: 0,
        totalLogs: 1,
        eventTypesCount: { $size: '$eventTypes' },
        categoriesCount: { $size: '$categories' },
        uniqueUsersCount: { $size: '$uniqueUsers' },
        uniqueIPsCount: { $size: '$uniqueIPs' },
        severityDistribution: 1,
        resultDistribution: 1
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalLogs: 0,
    eventTypesCount: 0,
    categoriesCount: 0,
    uniqueUsersCount: 0,
    uniqueIPsCount: 0,
    severityDistribution: [],
    resultDistribution: []
  };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);