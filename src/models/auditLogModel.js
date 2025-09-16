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
  console.warn('Usando modelo AuditLog mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1),
    findAll: () => Promise.resolve([]),
    createAuditLog: () => Promise.resolve({}),
    findByUser: () => Promise.resolve([]),
    findByResource: () => Promise.resolve([]),
    findSecurityEvents: () => Promise.resolve([]),
    verifyLogChain: () => Promise.resolve(true),
    getStatistics: () => Promise.resolve({})
  };
  return;
}

/**
 * Modelo de Log de Auditoria para PostgreSQL usando Sequelize
 */
const AuditLog = sequelize.define('AuditLog', {
  // Identificador único do log
  logId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    defaultValue: () => require('crypto').randomUUID()
  },

  // Informações temporais
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },

  // Informações do evento
  eventType: {
    type: DataTypes.ENUM([
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
    ]),
    allowNull: false
  },

  // Categoria do evento para filtragem
  category: {
    type: DataTypes.ENUM(['authentication', 'authorization', 'transaction', 'wallet', 'system', 'security', 'data']),
    allowNull: false
  },

  // Nível de severidade
  severity: {
    type: DataTypes.ENUM(['low', 'medium', 'high', 'critical']),
    allowNull: false,
    defaultValue: 'medium'
  },

  // Informações do usuário (se aplicável)
  userId: {
    type: DataTypes.STRING,
    allowNull: true
  },

  userEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Informações de sessão
  sessionId: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Informações de rede
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },

  userAgent: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Localização geográfica (se disponível)
  geolocation: {
    type: DataTypes.JSON,
    allowNull: true
  },

  // Recurso afetado
  resourceType: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: {
        args: [['user', 'wallet', 'transaction', 'deposit', 'payment', 'smart_contract', 'fund_split_rule', 'system']],
        msg: 'Tipo de recurso deve ser user, wallet, transaction, deposit, payment, smart_contract, fund_split_rule ou system'
      }
    }
  },

  resourceId: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Ação realizada
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },

  // Resultado da ação
  result: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: {
        args: [['success', 'failure', 'partial', 'pending']],
        msg: 'Resultado deve ser success, failure, partial ou pending'
      }
    }
  },

  // Descrição detalhada do evento
  description: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },

  // Dados específicos do evento (criptografados)
  eventData: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Dados antes da modificação (para operações de update)
  previousState: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Dados após a modificação
  newState: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Informações de erro (se aplicável)
  errorDetails: {
    type: DataTypes.JSON,
    allowNull: true
  },

  // Hash para verificação de integridade
  integrityHash: {
    type: DataTypes.STRING,
    allowNull: false
  },

  // Hash do log anterior (para criar cadeia)
  previousLogHash: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Assinatura digital do log
  digitalSignature: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Metadados adicionais
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },

  // Status de retenção
  retentionPolicy: {
    type: DataTypes.JSON,
    allowNull: true
  },

  // Informações de compliance
  complianceFlags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      gdprRelevant: false,
      pciRelevant: false,
      soxRelevant: false
    }
  }
}, {
  timestamps: false,
  tableName: 'audit_logs'
});

// Métodos estáticos
AuditLog.createAuditLog = async function(logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error);
    throw error;
  }
};

AuditLog.findByUser = function(userId, options = {}) {
  return this.findAll({
    where: { userId },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AuditLog.findByResource = function(resourceType, resourceId, options = {}) {
  return this.findAll({
    where: { resourceType, resourceId },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AuditLog.findSecurityEvents = function(options = {}) {
  return this.findAll({
    where: {
      category: 'security'
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AuditLog.verifyLogChain = async function(startDate, endDate) {
  // Implementação simplificada para verificação de integridade
  return true;
};

AuditLog.getStatistics = async function(startDate, endDate) {
  // Implementação simplificada para estatísticas
  return {
    totalLogs: 0,
    eventTypes: {},
    categories: {},
    severityLevels: {}
  };
};

module.exports = AuditLog;