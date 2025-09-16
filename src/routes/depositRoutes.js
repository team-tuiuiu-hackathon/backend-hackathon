const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const DepositController = require('../controllers/depositController');
// const authMiddleware = require('../middleware/authMiddleware').protect;
const errorHandler = require('../middleware/errorHandler');

const router = express.Router();

// Rate limiting para operações de depósito
const depositRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 operações por IP
  message: {
    status: 'error',
    message: 'Muitas tentativas de depósito. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const confirmationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // máximo 20 confirmações por IP
  message: {
    status: 'error',
    message: 'Muitas tentativas de confirmação. Tente novamente em 5 minutos.'
  }
});

// Validações
const walletIdValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser um ObjectId válido')
];

const depositIdValidation = [
  param('depositId')
    .isUUID(4)
    .withMessage('ID do depósito deve ser um UUID válido')
];

const registerDepositValidation = [
  body('amount')
    .isFloat({ min: 0.000001, max: 1000000 })
    .withMessage('Valor deve ser um número entre 0.000001 e 1,000,000 USDC'),
  body('txHash')
    .isLength({ min: 64, max: 64 })
    .matches(/^[a-fA-F0-9]{64}$/)
    .withMessage('Hash da transação deve ter 64 caracteres hexadecimais'),
  body('fromAddress')
    .isLength({ min: 56, max: 56 })
    .matches(/^G[A-Z2-7]{55}$/)
    .withMessage('Endereço de origem deve ser um endereço Stellar válido'),
  body('memo')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Memo deve ter no máximo 500 caracteres'),
  body('externalReference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Referência externa deve ter no máximo 100 caracteres')
];

const confirmDepositValidation = [
  body('blockNumber')
    .isInt({ min: 1 })
    .withMessage('Número do bloco deve ser um inteiro positivo'),
  body('confirmations')
    .isInt({ min: 1 })
    .withMessage('Número de confirmações deve ser um inteiro positivo'),
  body('fee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Taxa deve ser um número não negativo'),
  body('gasUsed')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Gas usado deve ser um inteiro não negativo')
];

const listDepositsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'failed', 'cancelled'])
    .withMessage('Status deve ser: pending, confirmed, failed ou cancelled'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um inteiro positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'amount', 'confirmedAt'])
    .withMessage('Ordenação deve ser: createdAt, amount ou confirmedAt'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem deve ser: asc ou desc'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial deve estar no formato ISO8601'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final deve estar no formato ISO8601')
];

const statsValidation = [
  query('period')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Período deve ser entre 1 e 365 dias')
];

// Rotas

// BE15 - Registrar depósito em USDC
router.post(
  '/wallets/:walletId/deposits',
  // authMiddleware,
  depositRateLimit,
  walletIdValidation,
  registerDepositValidation,
  DepositController.registerDeposit
);

// BE16 - Confirmar depósito (webhook ou processo interno)
router.put(
  '/deposits/:depositId/confirm',
  // authMiddleware,
  confirmationRateLimit,
  depositIdValidation,
  confirmDepositValidation,
  DepositController.confirmDeposit
);

// Listar depósitos de uma carteira
router.get(
  '/wallets/:walletId/deposits',
  // authMiddleware,
  walletIdValidation,
  listDepositsValidation,
  DepositController.getWalletDeposits
);

// Obter detalhes de um depósito específico
router.get(
  '/deposits/:depositId',
  // authMiddleware,
  depositIdValidation,
  DepositController.getDepositDetails
);

// Cancelar depósito pendente
router.delete(
  '/deposits/:depositId',
  // authMiddleware,
  depositRateLimit,
  depositIdValidation,
  DepositController.cancelDeposit
);

// Obter estatísticas de depósitos da carteira
router.get(
  '/wallets/:walletId/deposits/stats',
  // authMiddleware,
  walletIdValidation,
  statsValidation,
  DepositController.getWalletDepositStats
);

// Buscar depósitos pendentes de confirmação
router.get(
  '/wallets/:walletId/deposits/pending',
  // authMiddleware,
  walletIdValidation,
  DepositController.getPendingDeposits
);

// Reprocessar depósito falhado (apenas admins)
router.post(
  '/deposits/:depositId/retry',
  // authMiddleware,
  depositRateLimit,
  depositIdValidation,
  DepositController.retryDeposit
);

// Middleware de tratamento de erros específico para depósitos
router.use((error, req, res, next) => {
  // Log específico para erros de depósito
  console.error('Erro em operação de depósito:', {
    error: error.message,
    stack: error.stack,
    walletId: req.params.walletId,
    depositId: req.params.depositId,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Erros específicos de depósito
  if (error.message.includes('depósito já confirmado')) {
    return res.status(409).json({
      status: 'error',
      message: 'Este depósito já foi confirmado anteriormente',
      code: 'DEPOSIT_ALREADY_CONFIRMED'
    });
  }

  if (error.message.includes('transação não encontrada')) {
    return res.status(404).json({
      status: 'error',
      message: 'Transação não encontrada na blockchain',
      code: 'TRANSACTION_NOT_FOUND'
    });
  }

  if (error.message.includes('confirmações insuficientes')) {
    return res.status(400).json({
      status: 'error',
      message: 'Número de confirmações insuficiente para processar o depósito',
      code: 'INSUFFICIENT_CONFIRMATIONS'
    });
  }

  if (error.message.includes('valor não confere')) {
    return res.status(400).json({
      status: 'error',
      message: 'O valor informado não confere com o valor da transação',
      code: 'AMOUNT_MISMATCH'
    });
  }

  // Usar o handler de erro padrão
  errorHandler(error, req, res, next);
});

module.exports = router;
