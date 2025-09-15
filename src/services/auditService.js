const AuditLog = require('../models/auditLogModel');
const crypto = require('crypto');
// Mock do geoip-lite para desenvolvimento
const geoip = {
  lookup: (ip) => {
    if (ip === 'unknown' || ip.includes('127.0.0.1') || ip.includes('::1')) {
      return null;
    }
    
    // Mock de dados de geolocalização
    return {
      country: 'BR',
      region: 'SP',
      city: 'São Paulo',
      ll: [-23.5505, -46.6333] // [latitude, longitude]
    };
  }
};

/**
 * Serviço para gerenciamento de logs de auditoria
 * Implementa logging seguro, criptografia e verificação de integridade
 */
class AuditService {
  constructor() {
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key-change-in-production';
    this.signatureKey = process.env.AUDIT_SIGNATURE_KEY || 'default-signature-key-change-in-production';
  }

  /**
   * Cria um novo log de auditoria
   * @param {Object} logData - Dados do log
   * @param {Object} context - Contexto da requisição (req, user, etc.)
   * @returns {Promise<Object>} Log criado
   */
  async createLog(logData, context = {}) {
    try {
      // Extrair informações do contexto
      const { req, user, session } = context;
      
      // Obter informações de rede
      const ipAddress = this.extractIPAddress(req);
      const userAgent = req?.headers?.['user-agent'] || 'Unknown';
      const geolocation = this.getGeolocation(ipAddress);

      // Preparar dados do log
      const auditLogData = {
        eventType: logData.eventType,
        category: logData.category,
        severity: logData.severity || 'medium',
        userId: user?.id || logData.userId,
        userEmail: user?.email || logData.userEmail,
        sessionId: session?.id || req?.sessionID,
        ipAddress,
        userAgent,
        geolocation,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        action: logData.action,
        result: logData.result,
        description: logData.description,
        errorDetails: logData.errorDetails,
        metadata: {
          applicationVersion: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'production',
          correlationId: logData.correlationId || this.generateCorrelationId(),
          traceId: logData.traceId || this.generateTraceId(),
          tags: logData.tags || []
        },
        complianceFlags: logData.complianceFlags || {}
      };

      // Criptografar dados sensíveis
      if (logData.eventData) {
        auditLogData.eventData = this.encryptData(logData.eventData);
      }

      if (logData.previousState) {
        auditLogData.previousState = this.encryptData(logData.previousState);
      }

      if (logData.newState) {
        auditLogData.newState = this.encryptData(logData.newState);
      }

      // Definir política de retenção
      auditLogData.retentionPolicy = this.calculateRetentionPolicy(logData.category, logData.severity);

      // Criar assinatura digital
      auditLogData.digitalSignature = this.createDigitalSignature(auditLogData);

      // Salvar log
      const auditLog = await AuditLog.createAuditLog(auditLogData);

      return {
        logId: auditLog.logId,
        timestamp: auditLog.timestamp,
        eventType: auditLog.eventType,
        result: auditLog.result
      };

    } catch (error) {
      console.error('Erro ao criar log de auditoria:', error);
      
      // Em caso de erro, tentar criar um log de erro simplificado
      try {
        await this.createErrorLog(error, logData, context);
      } catch (errorLogError) {
        console.error('Erro crítico no sistema de auditoria:', errorLogError);
      }
      
      throw error;
    }
  }

  /**
   * Busca logs de auditoria com filtros
   * @param {Object} filters - Filtros de busca
   * @param {Object} options - Opções de paginação e ordenação
   * @returns {Promise<Object>} Resultado da busca
   */
  async searchLogs(filters = {}, options = {}) {
    try {
      const {
        eventType,
        category,
        severity,
        userId,
        resourceType,
        resourceId,
        result,
        startDate,
        endDate,
        ipAddress,
        correlationId,
        traceId
      } = filters;

      const {
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        includeData = false
      } = options;

      // Construir query
      const query = {};

      if (eventType) query.eventType = eventType;
      if (category) query.category = category;
      if (severity) query.severity = severity;
      if (userId) query.userId = userId;
      if (resourceType) query.resourceType = resourceType;
      if (resourceId) query.resourceId = resourceId;
      if (result) query.result = result;
      if (ipAddress) query.ipAddress = ipAddress;
      if (correlationId) query['metadata.correlationId'] = correlationId;
      if (traceId) query['metadata.traceId'] = traceId;

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      // Executar busca
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [logs, totalCount] = await Promise.all([
        AuditLog.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('userId', 'name email'),
        AuditLog.countDocuments(query)
      ]);

      // Processar logs para resposta
      const processedLogs = logs.map(log => {
        const logData = {
          logId: log.logId,
          timestamp: log.timestamp,
          eventType: log.eventType,
          category: log.category,
          severity: log.severity,
          userId: log.userId,
          userEmail: log.userEmail,
          ipAddress: log.ipAddress,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          action: log.action,
          result: log.result,
          description: log.description,
          metadata: log.metadata
        };

        // Incluir dados descriptografados se solicitado
        if (includeData) {
          if (log.eventData) {
            logData.eventData = this.decryptData(log.eventData);
          }
          if (log.previousState) {
            logData.previousState = this.decryptData(log.previousState);
          }
          if (log.newState) {
            logData.newState = this.decryptData(log.newState);
          }
        }

        return logData;
      });

      return {
        logs: processedLogs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: limit
        }
      };

    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de auditoria
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Estatísticas
   */
  async getStatistics(startDate, endDate) {
    try {
      const [
        generalStats,
        eventTypeStats,
        severityStats,
        resultStats,
        categoryStats
      ] = await Promise.all([
        AuditLog.getStatistics(startDate, endDate),
        this.getEventTypeStatistics(startDate, endDate),
        this.getSeverityStatistics(startDate, endDate),
        this.getResultStatistics(startDate, endDate),
        this.getCategoryStatistics(startDate, endDate)
      ]);

      return {
        general: generalStats,
        eventTypes: eventTypeStats,
        severity: severityStats,
        results: resultStats,
        categories: categoryStats,
        period: {
          startDate,
          endDate
        }
      };

    } catch (error) {
      console.error('Erro ao obter estatísticas de auditoria:', error);
      throw error;
    }
  }

  /**
   * Verifica a integridade da cadeia de logs
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Resultado da verificação
   */
  async verifyIntegrity(startDate, endDate) {
    try {
      const result = await AuditLog.verifyLogChain(startDate, endDate);
      
      return {
        ...result,
        integrityPercentage: result.totalLogs > 0 
          ? (result.validLogs / result.totalLogs) * 100 
          : 100,
        verificationDate: new Date(),
        period: {
          startDate,
          endDate
        }
      };

    } catch (error) {
      console.error('Erro ao verificar integridade dos logs:', error);
      throw error;
    }
  }

  /**
   * Exporta logs para arquivo
   * @param {Object} filters - Filtros de exportação
   * @param {string} format - Formato do arquivo (json, csv)
   * @returns {Promise<Buffer>} Dados do arquivo
   */
  async exportLogs(filters = {}, format = 'json') {
    try {
      const { logs } = await this.searchLogs(filters, { 
        limit: 10000, 
        includeData: true 
      });

      if (format === 'csv') {
        return this.convertToCSV(logs);
      }

      return Buffer.from(JSON.stringify(logs, null, 2));

    } catch (error) {
      console.error('Erro ao exportar logs:', error);
      throw error;
    }
  }

  /**
   * Arquiva logs antigos
   * @param {Date} cutoffDate - Data limite para arquivamento
   * @returns {Promise<Object>} Resultado do arquivamento
   */
  async archiveLogs(cutoffDate) {
    try {
      const logsToArchive = await AuditLog.find({
        timestamp: { $lt: cutoffDate },
        'retentionPolicy.archived': false
      });

      let archivedCount = 0;
      const errors = [];

      for (const log of logsToArchive) {
        try {
          // Aqui você implementaria a lógica de arquivamento
          // Por exemplo, mover para storage externo (S3, etc.)
          
          await AuditLog.findByIdAndUpdate(log._id, {
            'retentionPolicy.archived': true,
            'retentionPolicy.archiveLocation': 'external-storage'
          });

          archivedCount++;
        } catch (error) {
          errors.push({
            logId: log.logId,
            error: error.message
          });
        }
      }

      return {
        totalProcessed: logsToArchive.length,
        archivedCount,
        errorCount: errors.length,
        errors
      };

    } catch (error) {
      console.error('Erro ao arquivar logs:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */

  extractIPAddress(req) {
    if (!req) return 'unknown';
    
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers?.['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  getGeolocation(ipAddress) {
    if (!ipAddress || ipAddress === 'unknown' || ipAddress.includes('127.0.0.1') || ipAddress.includes('::1')) {
      return null;
    }

    try {
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        return {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          coordinates: {
            latitude: geo.ll[0],
            longitude: geo.ll[1]
          }
        };
      }
    } catch (error) {
      console.error('Erro ao obter geolocalização:', error);
    }

    return null;
  }

  generateCorrelationId() {
    return crypto.randomUUID();
  }

  generateTraceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  encryptData(data) {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('Erro ao criptografar dados:', error);
      return null;
    }
  }

  decryptData(encryptedData) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Erro ao descriptografar dados:', error);
      return null;
    }
  }

  createDigitalSignature(data) {
    try {
      const dataString = JSON.stringify(data);
      return crypto
        .createHmac('sha256', this.signatureKey)
        .update(dataString)
        .digest('hex');
    } catch (error) {
      console.error('Erro ao criar assinatura digital:', error);
      return null;
    }
  }

  calculateRetentionPolicy(category, severity) {
    const now = new Date();
    let retentionDays;

    // Definir período de retenção baseado na categoria e severidade
    switch (severity) {
      case 'critical':
        retentionDays = 2555; // 7 anos
        break;
      case 'high':
        retentionDays = 1825; // 5 anos
        break;
      case 'medium':
        retentionDays = 1095; // 3 anos
        break;
      case 'low':
        retentionDays = 365; // 1 ano
        break;
      default:
        retentionDays = 1095; // 3 anos (padrão)
    }

    // Ajustar baseado na categoria
    if (category === 'security' || category === 'transaction') {
      retentionDays = Math.max(retentionDays, 2555); // Mínimo 7 anos
    }

    const retainUntil = new Date(now);
    retainUntil.setDate(retainUntil.getDate() + retentionDays);

    return {
      retainUntil,
      archived: false
    };
  }

  async createErrorLog(error, originalLogData, context) {
    const errorLogData = {
      eventType: 'system_error',
      category: 'system',
      severity: 'high',
      action: 'audit_log_creation',
      result: 'failure',
      description: `Erro ao criar log de auditoria: ${error.message}`,
      errorDetails: {
        code: error.code || 'AUDIT_ERROR',
        message: error.message,
        stack: error.stack
      },
      eventData: this.encryptData({
        originalLogData,
        errorContext: context
      })
    };

    return await AuditLog.createAuditLog(errorLogData);
  }

  async getEventTypeStatistics(startDate, endDate) {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
          },
          failureCount: {
            $sum: { $cond: [{ $eq: ['$result', 'failure'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  async getSeverityStatistics(startDate, endDate) {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  async getResultStatistics(startDate, endDate) {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  async getCategoryStatistics(startDate, endDate) {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  convertToCSV(logs) {
    if (!logs || logs.length === 0) {
      return Buffer.from('');
    }

    const headers = [
      'logId', 'timestamp', 'eventType', 'category', 'severity',
      'userId', 'userEmail', 'ipAddress', 'action', 'result', 'description'
    ];

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = headers.map(header => {
        let value = log[header] || '';
        
        // Escapar aspas e quebras de linha
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""');
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`;
          }
        }
        
        return value;
      });
      
      csvRows.push(row.join(','));
    });

    return Buffer.from(csvRows.join('\n'));
  }
}

module.exports = AuditService;