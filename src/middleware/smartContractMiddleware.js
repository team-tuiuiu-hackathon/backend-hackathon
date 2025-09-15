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
   * Middleware para validação de endereços de carteira Stellar
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static validateWalletAddress(req, res, next) {
    const { walletAddress, address } = req.body;
    const addressToValidate = walletAddress || address;
    
    if (!addressToValidate) {
      return res.status(400).json({
        success: false,
        message: 'Endereço da carteira é obrigatório',
        code: 'MISSING_WALLET_ADDRESS'
      });
    }

    // Validar formato do endereço Stellar
    const stellarAddressRegex = /^G[A-Z2-7]{55}$/;
    if (!stellarAddressRegex.test(addressToValidate)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de endereço Stellar inválido',
        code: 'INVALID_STELLAR_ADDRESS_FORMAT'
      });
    }

    // Verificar se não é um endereço conhecido como malicioso
    const blacklistedAddresses = [
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', // Endereço nulo
      'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' // Endereço de teste
    ];

    if (blacklistedAddresses.includes(addressToValidate)) {
      return res.status(400).json({
        success: false,
        message: 'Endereço de carteira não permitido',
        code: 'BLACKLISTED_WALLET_ADDRESS'
      });
    }

    next();
  }

  /**
   * Middleware para validação de chaves privadas Stellar
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static validateStellarPrivateKey(req, res, next) {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: 'Chave privada é obrigatória',
        code: 'MISSING_PRIVATE_KEY'
      });
    }

    // Validar formato da chave privada Stellar
    const stellarPrivateKeyRegex = /^S[A-Z2-7]{55}$/;
    if (!stellarPrivateKeyRegex.test(privateKey)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de chave privada Stellar inválido',
        code: 'INVALID_STELLAR_PRIVATE_KEY_FORMAT'
      });
    }

    next();
  }

  /**
   * Middleware para validação de valores monetários USDC
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static validateAmount(req, res, next) {
    const { amount } = req.body;
    
    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Valor é obrigatório',
        code: 'MISSING_AMOUNT'
      });
    }

    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valor deve ser um número positivo',
        code: 'INVALID_AMOUNT'
      });
    }

    // Valor mínimo para USDC (0.000001)
    if (numAmount < 0.000001) {
      return res.status(400).json({
        success: false,
        message: 'Valor mínimo é 0.000001 USDC',
        code: 'AMOUNT_TOO_SMALL'
      });
    }

    // Valor máximo para segurança (1 milhão USDC)
    if (numAmount > 1000000) {
      return res.status(400).json({
        success: false,
        message: 'Valor máximo é 1.000.000 USDC',
        code: 'AMOUNT_TOO_LARGE'
      });
    }

    // Normalizar para 6 casas decimais (padrão USDC)
    req.body.amount = Math.round(numAmount * 1000000) / 1000000;

    next();
  }

  /**
   * Middleware para validação de hash de transação Stellar
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static validateTransactionHash(req, res, next) {
    const { txHash } = req.params;
    
    if (!txHash) {
      return res.status(400).json({
        success: false,
        message: 'Hash da transação é obrigatório',
        code: 'MISSING_TRANSACTION_HASH'
      });
    }

    // Hash de transação Stellar deve ter 64 caracteres hexadecimais
    const hashRegex = /^[a-fA-F0-9]{64}$/;
    if (!hashRegex.test(txHash)) {
      return res.status(400).json({
        success: false,
        message: 'Hash de transação inválido',
        code: 'INVALID_TRANSACTION_HASH'
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