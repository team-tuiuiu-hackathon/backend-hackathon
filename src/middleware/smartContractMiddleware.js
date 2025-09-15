const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

/**
 * Middleware para validação de segurança de smart contracts
 */
class SmartContractMiddleware {
  /**
   * Middleware para sanitização de dados de entrada
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static sanitizeInput(req, res, next) {
    try {
      // Sanitizar strings para prevenir ataques de injeção
      const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        return str
          .replace(/[<>"']/g, '') // Remove caracteres perigosos
          .trim() // Remove espaços em branco
          .substring(0, 1000); // Limita tamanho
      };

      // Sanitizar recursivamente objetos
      const sanitizeObject = (obj) => {
        if (obj === null || typeof obj !== 'object') {
          return typeof obj === 'string' ? sanitizeString(obj) : obj;
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          const sanitizedKey = sanitizeString(key);
          sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
      };

      // Aplicar sanitização ao body da requisição
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }

      // Aplicar sanitização aos query parameters
      if (req.query) {
        req.query = sanitizeObject(req.query);
      }

      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Erro na sanitização dos dados de entrada',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Middleware para validação de endereços de carteira
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static validateWalletAddress(req, res, next) {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Endereço da carteira é obrigatório'
      });
    }

    // Validação de formato Ethereum
    const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethereumAddressRegex.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de endereço Ethereum inválido'
      });
    }

    // Verificar se não é um endereço conhecido como malicioso (lista básica)
    const blacklistedAddresses = [
      '0x0000000000000000000000000000000000000000', // Endereço zero
      '0x000000000000000000000000000000000000dead', // Endereço burn comum
    ];

    if (blacklistedAddresses.includes(address.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Endereço não permitido'
      });
    }

    next();
  }

  /**
   * Middleware para logging de atividades de smart contract
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static logActivity(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override do método send para capturar a resposta
    res.send = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log da atividade
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id || 'anonymous'
      };

      // Log apenas em desenvolvimento ou para erros
      if (process.env.NODE_ENV === 'development' || res.statusCode >= 400) {
        console.log('Smart Contract Activity:', JSON.stringify(logData, null, 2));
      }

      // Chamar o método original
      originalSend.call(this, data);
    };

    next();
  }

  /**
   * Middleware para verificação de integridade de transações
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static validateTransactionIntegrity(req, res, next) {
    const { walletId, contractMethod, parameters } = req.body;

    // Verificar se o método do contrato é permitido
    const allowedMethods = [
      'transfer',
      'approve',
      'mint',
      'burn',
      'stake',
      'unstake',
      'claim',
      'vote',
      'delegate'
    ];

    if (!allowedMethods.includes(contractMethod)) {
      return res.status(403).json({
        success: false,
        message: 'Método de contrato não permitido'
      });
    }

    // Validar parâmetros baseado no método
    if (contractMethod === 'transfer' && (!parameters || parameters.length < 2)) {
      return res.status(400).json({
        success: false,
        message: 'Método transfer requer pelo menos 2 parâmetros (destinatário e valor)'
      });
    }

    // Verificar limites de valor para transações financeiras
    const financialMethods = ['transfer', 'mint', 'stake'];
    if (financialMethods.includes(contractMethod) && parameters && parameters[1]) {
      const value = parseFloat(parameters[1]);
      const maxValue = 1000000; // Limite máximo por transação
      
      if (value > maxValue) {
        return res.status(400).json({
          success: false,
          message: `Valor da transação excede o limite máximo de ${maxValue}`
        });
      }
    }

    next();
  }

  /**
   * Middleware para tratamento de erros específicos de smart contract
   * @param {Error} error - Erro capturado
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static handleSmartContractErrors(error, req, res, next) {
    console.error('Smart Contract Error:', error);

    // Erros específicos de smart contract
    if (error.message.includes('insufficient funds')) {
      return res.status(400).json({
        success: false,
        message: 'Fundos insuficientes na carteira',
        code: 'INSUFFICIENT_FUNDS'
      });
    }

    if (error.message.includes('gas limit')) {
      return res.status(400).json({
        success: false,
        message: 'Limite de gas excedido',
        code: 'GAS_LIMIT_EXCEEDED'
      });
    }

    if (error.message.includes('nonce')) {
      return res.status(400).json({
        success: false,
        message: 'Erro de sequência de transação (nonce)',
        code: 'INVALID_NONCE'
      });
    }

    if (error.message.includes('revert')) {
      return res.status(400).json({
        success: false,
        message: 'Transação revertida pelo smart contract',
        code: 'TRANSACTION_REVERTED'
      });
    }

    // Erro de validação de carteira
    if (error.message.includes('carteira')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'WALLET_ERROR'
      });
    }

    // Erro genérico
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor de smart contract',
      code: 'INTERNAL_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  /**
   * Rate limiter específico para operações críticas
   */
  static criticalOperationsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5, // máximo 5 operações críticas por minuto
    message: {
      success: false,
      message: 'Limite de operações críticas excedido. Aguarde 1 minuto.',
      code: 'RATE_LIMIT_CRITICAL'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Aplicar apenas para métodos específicos
    skip: (req) => {
      const criticalMethods = ['mint', 'burn', 'transfer'];
      return !criticalMethods.includes(req.body?.contractMethod);
    }
  });
}

module.exports = SmartContractMiddleware;