const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const SmartContractController = require('../controllers/smartContractController');
const authMiddleware = require('../middleware/authMiddleware').protect;
const smartContractMiddleware = require('../middleware/smartContractMiddleware');
const errorHandler = require('../middleware/errorHandler');

const router = express.Router();

// Instanciar o controlador
const contractController = new SmartContractController();

// Rate limiting para operações de contrato
const contractRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 operações por IP
  message: {
    status: 'error',
    message: 'Muitas operações de contrato. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validações
const walletIdValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser um ObjectId válido')
];

const transactionIdValidation = [
  param('transactionId')
    .isUUID(4)
    .withMessage('ID da transação deve ser um UUID válido')
];

const depositIdValidation = [
  param('depositId')
    .isUUID(4)
    .withMessage('ID do depósito deve ser um UUID válido')
];

const paymentIdValidation = [
  param('paymentId')
    .isUUID(4)
    .withMessage('ID do pagamento deve ser um UUID válido')
];

const txHashValidation = [
  param('txHash')
    .isLength({ min: 64, max: 64 })
    .matches(/^[a-fA-F0-9]{64}$/)
    .withMessage('Hash da transação deve ter 64 caracteres hexadecimais')
];

const contractActionValidation = [
  body('action')
    .isIn(['propose', 'sign', 'execute'])
    .withMessage('Ação deve ser: propose, sign ou execute'),
  body('signature')
    .optional()
    .isLength({ min: 64, max: 128 })
    .matches(/^[a-fA-F0-9]+$/)
    .withMessage('Assinatura deve ser uma string hexadecimal válida')
];

// Rotas de inicialização e status

// Inicializar conexão com Soroban
router.post(
  '/initialize',
  authMiddleware,
  contractRateLimit,
  (req, res) => {
    res.json({
      status: 'success',
      message: 'Soroban inicializado (mock)',
      data: { network: 'testnet', status: 'connected' }
    });
  }
);

// Obter status da rede Soroban
router.get(
  '/network/status',
  authMiddleware,
  contractController.getNetworkStatus.bind(contractController)
);

// Rotas de carteiras

// Sincronizar carteira com contrato Soroban
router.post(
  '/wallets/:walletId/sync',
  authMiddleware,
  contractRateLimit,
  walletIdValidation,
  contractController.syncWalletWithContract.bind(contractController)
);

// Verificar saldo no contrato
router.get(
  '/wallets/:walletId/balance',
  authMiddleware,
  walletIdValidation,
  contractController.getContractBalance.bind(contractController)
);

// Rotas de transações

// Processar transação no contrato
router.post(
  '/transactions/:transactionId/process',
  authMiddleware,
  contractRateLimit,
  transactionIdValidation,
  contractActionValidation,
  smartContractMiddleware.sanitizeInput,
  contractController.processContractTransaction.bind(contractController)
);

// Rotas de depósitos

// Processar depósito no contrato
router.post(
  '/deposits/:depositId/process',
  authMiddleware,
  contractRateLimit,
  depositIdValidation,
  smartContractMiddleware.sanitizeInput,
  contractController.processContractDeposit.bind(contractController)
);

// Rotas de pagamentos

// Processar pagamento no contrato
router.post(
  '/payments/:paymentId/process',
  authMiddleware,
  contractRateLimit,
  paymentIdValidation,
  smartContractMiddleware.sanitizeInput,
  contractController.processContractPayment.bind(contractController)
);

// Rotas de blockchain

// Obter detalhes de transação da blockchain
router.get(
  '/transactions/:txHash/details',
  authMiddleware,
  txHashValidation,
  contractController.getTransactionDetails.bind(contractController)
);

// Rotas legadas (mantidas para compatibilidade)

// Conectar carteira ao smart contract
router.post(
  '/connect-wallet',
  authMiddleware,
  contractRateLimit,
  [
    body('walletAddress')
      .isLength({ min: 56, max: 56 })
      .matches(/^G[A-Z2-7]{55}$/)
      .withMessage('Endereço da carteira deve ser um endereço Stellar válido'),
    body('privateKey')
      .isLength({ min: 56, max: 56 })
      .matches(/^S[A-Z2-7]{55}$/)
      .withMessage('Chave privada deve ser uma chave Stellar válida')
  ],
  smartContractMiddleware.sanitizeInput,
  SmartContractController.connectWallet
);

// Executar transação no smart contract
router.post(
  '/execute-transaction',
  authMiddleware,
  contractRateLimit,
  [
    body('transactionData')
      .isObject()
      .withMessage('Dados da transação devem ser um objeto'),
    body('transactionData.amount')
      .isFloat({ min: 0.000001 })
      .withMessage('Valor deve ser maior que 0.000001'),
    body('transactionData.recipient')
      .isLength({ min: 56, max: 56 })
      .matches(/^G[A-Z2-7]{55}$/)
      .withMessage('Destinatário deve ser um endereço Stellar válido')
  ],
  smartContractMiddleware.sanitizeInput,
  SmartContractController.executeTransaction
);

// Obter status do smart contract
router.get(
  '/status',
  authMiddleware,
  SmartContractController.getContractStatus
);

// Middleware de tratamento de erros específico para smart contracts
router.use((error, req, res, next) => {
  // Log específico para erros de smart contract
  console.error('Erro em operação de smart contract:', {
    error: error.message,
    stack: error.stack,
    walletId: req.params.walletId,
    transactionId: req.params.transactionId,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Erros específicos de Soroban
  if (error.message.includes('Soroban')) {
    return res.status(503).json({
      status: 'error',
      message: 'Serviço Soroban temporariamente indisponível',
      code: 'SOROBAN_UNAVAILABLE'
    });
  }

  if (error.message.includes('contrato não configurado')) {
    return res.status(500).json({
      status: 'error',
      message: 'Contrato multisig não está configurado',
      code: 'CONTRACT_NOT_CONFIGURED'
    });
  }

  if (error.message.includes('transação não encontrada na blockchain')) {
    return res.status(404).json({
      status: 'error',
      message: 'Transação não encontrada na blockchain',
      code: 'TRANSACTION_NOT_FOUND_ON_CHAIN'
    });
  }

  if (error.message.includes('saldo insuficiente')) {
    return res.status(400).json({
      status: 'error',
      message: 'Saldo insuficiente no contrato',
      code: 'INSUFFICIENT_CONTRACT_BALANCE'
    });
  }

  if (error.message.includes('falha na inicialização')) {
    return res.status(500).json({
      status: 'error',
      message: 'Falha na inicialização do contrato',
      code: 'CONTRACT_INITIALIZATION_FAILED'
    });
  }

  // Usar o handler de erro padrão
  errorHandler(error, req, res, next);
});

module.exports = router;