const express = require('express');
const { body, param, query } = require('express-validator');
const SmartContractController = require('../controllers/smartContractController');
const { protect: authMiddleware } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting para endpoints de smart contract
const smartContractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por janela de tempo
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting mais restritivo para transações
const transactionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 transações por IP por janela de tempo
  message: {
    success: false,
    message: 'Limite de transações excedido. Tente novamente em 5 minutos.'
  }
});

// Validações para conexão de carteira
const validateWalletConnection = [
  body('address')
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Endereço de carteira deve ser um endereço Ethereum válido'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata deve ser um objeto válido'),
  body('metadata.*')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Valores de metadata não podem exceder 500 caracteres')
];

// Validações para execução de transação
const validateTransaction = [
  body('walletId')
    .isUUID()
    .withMessage('ID da carteira deve ser um UUID válido'),
  body('contractMethod')
    .isString()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .withMessage('Método do contrato deve ser um identificador válido'),
  body('parameters')
    .optional()
    .isArray()
    .withMessage('Parâmetros devem ser um array'),
  body('parameters.*')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Parâmetros não podem exceder 1000 caracteres cada')
];

// Validações para parâmetros de rota
const validateWalletId = [
  param('walletId')
    .isUUID()
    .withMessage('ID da carteira deve ser um UUID válido')
];

// Validações para query parameters
const validateListQuery = [
  query('status')
    .optional()
    .isIn(['connected', 'disconnected', 'connecting', 'error'])
    .withMessage('Status deve ser: connected, disconnected, connecting ou error'),
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Página deve ser um número entre 1 e 1000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser um número entre 1 e 100')
];

/**
 * @route POST /api/smart-contract/connect
 * @desc Conecta uma carteira ao smart contract
 * @access Private
 */
router.post('/connect',
  smartContractLimiter,
  authMiddleware,
  validateWalletConnection,
  SmartContractController.connectWallet
);

/**
 * @route PUT /api/smart-contract/disconnect/:walletId
 * @desc Desconecta uma carteira do smart contract
 * @access Private
 */
router.put('/disconnect/:walletId',
  smartContractLimiter,
  authMiddleware,
  validateWalletId,
  SmartContractController.disconnectWallet
);

/**
 * @route GET /api/smart-contract/wallets
 * @desc Lista todas as carteiras
 * @access Private
 */
router.get('/wallets',
  smartContractLimiter,
  authMiddleware,
  validateListQuery,
  SmartContractController.listWallets
);

/**
 * @route GET /api/smart-contract/wallets/:walletId
 * @desc Obtém informações de uma carteira específica
 * @access Private
 */
router.get('/wallets/:walletId',
  smartContractLimiter,
  authMiddleware,
  validateWalletId,
  SmartContractController.getWallet
);

/**
 * @route POST /api/smart-contract/transaction
 * @desc Executa uma transação no smart contract
 * @access Private
 */
router.post('/transaction',
  transactionLimiter,
  authMiddleware,
  validateTransaction,
  SmartContractController.executeTransaction
);

/**
 * @route GET /api/smart-contract/health
 * @desc Verifica o status de saúde do serviço de smart contract
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Serviço de smart contract operacional',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

module.exports = router;