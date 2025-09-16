const { DataTypes } = require('sequelize');
const { initializeSequelize } = require('../config/sequelizeConfig');

const sequelize = initializeSequelize();

// Se não conseguir conectar com o banco, retorna um modelo mock
if (!sequelize) {
  console.warn('Usando modelo NotificationQueue mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1),
    findAll: () => Promise.resolve([]),
    addToQueue: () => Promise.resolve({}),
    processQueue: () => Promise.resolve([]),
    markAsSent: () => Promise.resolve({}),
    markAsFailed: () => Promise.resolve({}),
    getQueueStats: () => Promise.resolve({})
  };
  return;
}

/**
 * Modelo para fila de notificações
 * Gerencia notificações pendentes, enviadas e com falha
 */
const NotificationQueue = sequelize.define('NotificationQueue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único da notificação (chave primária)'
  },
  recipientType: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'recipient_type',
    comment: 'Tipo de destinatário',
    validate: {
      isIn: {
        args: [['email', 'sms', 'push', 'webhook']],
        msg: 'Tipo de destinatário deve ser email, sms, push ou webhook'
      }
    }
  },
  recipientAddress: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'recipient_address',
    validate: {
      notEmpty: {
        msg: 'Endereço do destinatário é obrigatório'
      }
    },
    comment: 'Endereço do destinatário (email, telefone, etc.)'
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Assunto da notificação (para email)'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Mensagem é obrigatória'
      }
    },
    comment: 'Conteúdo da mensagem'
  },
  templateName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'template_name',
    comment: 'Nome do template utilizado'
  },
  templateData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'template_data',
    comment: 'Dados para o template'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Prioridade da notificação (1=alta, 5=normal, 10=baixa)'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Status da notificação',
    validate: {
      isIn: {
        args: [['pending', 'sent', 'failed', 'cancelled']],
        msg: 'Status deve ser pending, sent, failed ou cancelled'
      }
    }
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Número de tentativas de envio'
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'max_attempts',
    comment: 'Número máximo de tentativas'
  },
  scheduledFor: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'scheduled_for',
    comment: 'Data agendada para envio'
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at',
    comment: 'Data de envio bem-sucedido'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
    comment: 'Mensagem de erro da última tentativa'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Metadados adicionais'
  }
}, {
  tableName: 'notification_queue',
  timestamps: true,
  indexes: [
    {
      fields: ['status'],
      name: 'idx_notification_queue_status'
    },
    {
      fields: ['scheduled_for'],
      name: 'idx_notification_queue_scheduled'
    },
    {
      fields: ['priority'],
      name: 'idx_notification_queue_priority'
    },
    {
      fields: ['recipient_type', 'recipient_address'],
      name: 'idx_notification_queue_recipient'
    }
  ]
});

/**
 * Busca notificações pendentes para processamento
 */
NotificationQueue.findPendingNotifications = async function(limit = 50) {
  return await this.findAll({
    where: {
      status: 'pending',
      scheduledFor: {
        [require('sequelize').Op.lte]: new Date()
      },
      attempts: {
        [require('sequelize').Op.lt]: sequelize.col('max_attempts')
      }
    },
    order: [
      ['priority', 'ASC'],
      ['scheduled_for', 'ASC']
    ],
    limit
  });
};

/**
 * Marca notificação como enviada
 */
NotificationQueue.prototype.markAsSent = async function() {
  await this.update({
    status: 'sent',
    sentAt: new Date()
  });
};

/**
 * Marca notificação como falhada
 */
NotificationQueue.prototype.markAsFailed = async function(errorMessage) {
  const newAttempts = this.attempts + 1;
  const status = newAttempts >= this.maxAttempts ? 'failed' : 'pending';
  
  await this.update({
    status,
    attempts: newAttempts,
    errorMessage,
    scheduledFor: status === 'pending' ? 
      new Date(Date.now() + Math.pow(2, newAttempts) * 60000) : // Backoff exponencial
      this.scheduledFor
  });
};

/**
 * Cancela notificação
 */
NotificationQueue.prototype.cancel = async function() {
  await this.update({
    status: 'cancelled'
  });
};

/**
 * Cria nova notificação na fila
 */
NotificationQueue.createNotification = async function(notificationData) {
  return await this.create({
    recipientType: notificationData.recipientType,
    recipientAddress: notificationData.recipientAddress,
    subject: notificationData.subject,
    message: notificationData.message,
    templateName: notificationData.templateName,
    templateData: notificationData.templateData,
    priority: notificationData.priority || 5,
    scheduledFor: notificationData.scheduledFor || new Date(),
    maxAttempts: notificationData.maxAttempts || 3,
    metadata: notificationData.metadata
  });
};

/**
 * Remove notificações antigas
 */
NotificationQueue.cleanupOldNotifications = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const deleted = await this.destroy({
    where: {
      status: {
        [require('sequelize').Op.in]: ['sent', 'cancelled']
      },
      createdAt: {
        [require('sequelize').Op.lt]: cutoffDate
      }
    }
  });
  
  console.log(`Removidas ${deleted} notificações antigas`);
  return deleted;
};

/**
 * Obtém estatísticas da fila
 */
NotificationQueue.getQueueStatistics = async function() {
  const [statusStats, typeStats, priorityStats] = await Promise.all([
    // Estatísticas por status
    this.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    }),
    
    // Estatísticas por tipo
    this.findAll({
      attributes: [
        'recipient_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['recipient_type'],
      raw: true
    }),
    
    // Estatísticas por prioridade
    this.findAll({
      attributes: [
        'priority',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['priority'],
      raw: true
    })
  ]);

  return {
    byStatus: statusStats.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count);
      return acc;
    }, {}),
    byType: typeStats.reduce((acc, item) => {
      acc[item.recipient_type] = parseInt(item.count);
      return acc;
    }, {}),
    byPriority: priorityStats.reduce((acc, item) => {
      acc[`priority_${item.priority}`] = parseInt(item.count);
      return acc;
    }, {})
  };
};

module.exports = NotificationQueue;