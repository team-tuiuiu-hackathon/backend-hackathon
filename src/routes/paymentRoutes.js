const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const PaymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware').protect;
const errorHandler = require('../middleware/errorHandler');

const router = express.Router();

// Rate limiting para operações de pagamento
const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 propostas de pagamento por IP
  message: {
    status: 'error',
    message: 'Muitas propostas de pagamento. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const signatureRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // máximo 20 assinaturas por IP
  message: {
    status: 'error',
    message: 'Muitas tentativas de assinatura. Tente novamente em 5 minutos.'
  }
});

const executionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 10, // máximo 10 execuções por IP
  message: {
    status: 'error',
    message: 'Muitas tentativas de execução. Tente novamente em 10 minutos.'
  }
});

// Validações
const walletIdValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser um ObjectId válido')
];

const paymentIdValidation = [
  param('paymentId')
    .isUUID(4)
    .withMessage('ID do pagamento deve ser um UUID válido')
];

const proposePaymentValidation = [
  body('recipientAddress')
    .isLength({ min: 56, max: 56 })
    .matches(/^G[A-Z2-7]{55}$/)
    .withMessage('Endereço do destinatário deve ser um endereço Stellar válido'),
  body('recipientName')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-ZÀ-ÿ\s\-\.]+$/)
    .withMessage('Nome do destinatário deve ter entre 2 e 100 caracteres'),
  body('recipientEmail')
    .optional()
    .isEmail()
    .withMessage('Email do destinatário deve ser válido'),
  body('amount')
    .isFloat({ min: 0.000001, max: 1000000 })
    .withMessage('Valor deve ser um número entre 0.000001 e 1,000,000 USDC'),
  body('memo')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Memo deve ter no máximo 500 caracteres'),
  body('category')
    .optional()
    .isIn(['salary', 'expense', 'refund', 'dividend', 'other'])
    .withMessage('Categoria deve ser: salary, expense, refund, dividend ou other'),
  body('externalReference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Referência externa deve ter no máximo 100 caracteres')
];

const signPaymentValidation = [
  body('signature')
    .isLength({ min: 64, max: 128 })
    .matches(/^[a-fA-F0-9]+$/)
    .withMessage('Assinatura deve ser uma string hexadecimal válida'),
  body('publicKey')
    .isLength({ min: 56, max: 56 })
    .matches(/^G[A-Z2-7]{55}$/)
    .withMessage('Chave pública deve ser um endereço Stellar válido')
];

const executePaymentValidation = [
  body('txHash')
    .isLength({ min: 64, max: 64 })
    .matches(/^[a-fA-F0-9]{64}$/)
    .withMessage('Hash da transação deve ter 64 caracteres hexadecimais'),
  body('blockNumber')
    .isInt({ min: 1 })
    .withMessage('Número do bloco deve ser um inteiro positivo'),
  body('gasUsed')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Gas usado deve ser um inteiro não negativo'),
  body('fee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Taxa deve ser um número não negativo')
];

const listPaymentsValidation = [
  query('status')
    .optional()
    .isIn(['proposed', 'approved', 'executing', 'completed', 'failed', 'rejected'])
    .withMessage('Status deve ser: proposed, approved, executing, completed, failed ou rejected'),
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
    .isIn(['createdAt', 'amount', 'approvedAt', 'completedAt'])
    .withMessage('Ordenação deve ser: createdAt, amount, approvedAt ou completedAt'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem deve ser: asc ou desc')
];

const rejectPaymentValidation = [
  body('reason')
    .isLength({ min: 10, max: 500 })
    .withMessage('Motivo da rejeição deve ter entre 10 e 500 caracteres')
];

const statsValidation = [
  query('period')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Período deve ser entre 1 e 365 dias')
];

// Rotas

/**
 * @swagger
 * /api/v1/payments/wallets/{walletId}/payments:
 *   post:
 *     summary: Propor pagamento em USDC
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da carteira
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientAddress
 *               - recipientName
 *               - amount
 *             properties:
 *               recipientAddress:
 *                 type: string
 *                 pattern: '^G[A-Z2-7]{55}$'
 *                 description: Endereço Stellar do destinatário
 *               recipientName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Nome do destinatário
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 description: Email do destinatário (opcional)
 *               amount:
 *                 type: number
 *                 minimum: 0.000001
 *                 maximum: 1000000
 *                 description: Valor em USDC
 *               memo:
 *                 type: string
 *                 maxLength: 500
 *                 description: Memo da transação (opcional)
 *               category:
 *                 type: string
 *                 enum: [salary, expense, refund, dividend, other]
 *                 description: Categoria do pagamento
 *     responses:
 *       201:
 *         description: Pagamento proposto com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 */
// BE17 - Propor pagamento em USDC
router.post(
  '/wallets/:walletId/payments',
  authMiddleware,
  paymentRateLimit,
  walletIdValidation,
  proposePaymentValidation,
  PaymentController.proposePayment
);

/**
 * @swagger
 * /api/v1/payments/payments/{paymentId}/sign:
 *   post:
 *     summary: Assinar proposta de pagamento
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do pagamento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature
 *               - publicKey
 *             properties:
 *               signature:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]+$'
 *                 minLength: 64
 *                 maxLength: 128
 *                 description: Assinatura hexadecimal
 *               publicKey:
 *                 type: string
 *                 pattern: '^G[A-Z2-7]{55}$'
 *                 description: Chave pública Stellar
 *     responses:
 *       200:
 *         description: Pagamento assinado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       409:
 *         description: Pagamento já assinado
 */
// BE18 - Assinar proposta de pagamento
router.post(
  '/payments/:paymentId/sign',
  authMiddleware,
  signatureRateLimit,
  paymentIdValidation,
  signPaymentValidation,
  PaymentController.signPayment
);

// BE18 - Executar pagamento aprovado
router.post(
  '/payments/:paymentId/execute',
  authMiddleware,
  executionRateLimit,
  paymentIdValidation,
  executePaymentValidation,
  PaymentController.executePayment
);

// Listar pagamentos de uma carteira
router.get(
  '/wallets/:walletId/payments',
  authMiddleware,
  walletIdValidation,
  listPaymentsValidation,
  PaymentController.getWalletPayments
);

// Obter detalhes de um pagamento específico
router.get(
  '/payments/:paymentId',
  authMiddleware,
  paymentIdValidation,
  PaymentController.getPaymentDetails
);

// Rejeitar pagamento (apenas admins)
router.post(
  '/payments/:paymentId/reject',
  authMiddleware,
  paymentRateLimit,
  paymentIdValidation,
  rejectPaymentValidation,
  PaymentController.rejectPayment
);

// Obter estatísticas de pagamentos da carteira
router.get(
  '/wallets/:walletId/payments/stats',
  authMiddleware,
  walletIdValidation,
  statsValidation,
  PaymentController.getWalletPaymentStats
);

// Buscar pagamentos aprovados para execução
router.get(
  '/wallets/:walletId/payments/ready',
  authMiddleware,
  walletIdValidation,
  PaymentController.getReadyForExecution
);

// Middleware de tratamento de erros específico para pagamentos
router.use((error, req, res, next) => {
  // Log específico para erros de pagamento
  console.error('Erro em operação de pagamento:', {
    error: error.message,
    stack: error.stack,
    walletId: req.params.walletId,
    paymentId: req.params.paymentId,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Erros específicos de pagamento
  if (error.message.includes('saldo insuficiente')) {
    return res.status(400).json({
      status: 'error',
      message: 'Saldo insuficiente na carteira para realizar o pagamento',
      code: 'INSUFFICIENT_BALANCE'
    });
  }

  if (error.message.includes('já assinou')) {
    return res.status(409).json({
      status: 'error',
      message: 'Você já assinou este pagamento',
      code: 'ALREADY_SIGNED'
    });
  }

  if (error.message.includes('não está aprovado')) {
    return res.status(400).json({
      status: 'error',
      message: 'Pagamento não está aprovado para execução',
      code: 'NOT_APPROVED'
    });
  }

  if (error.message.includes('já foi executado')) {
    return res.status(409).json({
      status: 'error',
      message: 'Este pagamento já foi executado',
      code: 'ALREADY_EXECUTED'
    });
  }

  if (error.message.includes('expirado')) {
    return res.status(400).json({
      status: 'error',
      message: 'Este pagamento expirou e não pode mais ser processado',
      code: 'PAYMENT_EXPIRED'
    });
  }

  if (error.message.includes('endereço inválido')) {
    return res.status(400).json({
      status: 'error',
      message: 'Endereço do destinatário é inválido',
      code: 'INVALID_RECIPIENT_ADDRESS'
    });
  }

  if (error.message.includes('falha na execução')) {
    return res.status(500).json({
      status: 'error',
      message: 'Falha na execução do pagamento na blockchain',
      code: 'EXECUTION_FAILED'
    });
  }

  // Usar o handler de erro padrão
  errorHandler(error, req, res, next);
});

module.exports = router;