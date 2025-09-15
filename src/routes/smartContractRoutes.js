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
 * @swagger
 * /api/v1/smart-contract/connect:
 *   post:
 *     summary: Conectar carteira ao smart contract
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6634C0532925a3b8D0C9e3e4c4c4c4c4"
 *                 description: Endereço Ethereum válido
 *               metadata:
 *                 type: object
 *                 description: Metadados opcionais da carteira
 *                 example: {"walletType": "MetaMask", "network": "mainnet"}
 *     responses:
 *       200:
 *         description: Carteira conectada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Carteira conectada com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     wallet:
 *                       $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Muitas tentativas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Muitas tentativas. Tente novamente em 15 minutos."
 */
router.post('/connect',
  smartContractLimiter,
  authMiddleware,
  validateWalletConnection,
  SmartContractController.connectWallet
);

/**
 * @swagger
 * /api/v1/smart-contract/disconnect/{walletId}:
 *   put:
 *     summary: Desconectar carteira do smart contract
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único da carteira
 *     responses:
 *       200:
 *         description: Carteira desconectada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Carteira desconectada com sucesso"
 *       400:
 *         description: ID da carteira inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Carteira não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/disconnect/:walletId',
  smartContractLimiter,
  authMiddleware,
  validateWalletId,
  SmartContractController.disconnectWallet
);

/**
 * @swagger
 * /api/v1/smart-contract/wallets:
 *   get:
 *     summary: Listar todas as carteiras
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [connected, disconnected, connecting, error]
 *         description: Filtrar por status da carteira
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Limite de resultados por página
 *     responses:
 *       200:
 *         description: Lista de carteiras
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     wallets:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Wallet'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         total:
 *                           type: integer
 *                           example: 25
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/wallets',
  smartContractLimiter,
  authMiddleware,
  validateListQuery,
  SmartContractController.listWallets
);

/**
 * @swagger
 * /api/v1/smart-contract/wallets/{walletId}:
 *   get:
 *     summary: Obter informações de uma carteira específica
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único da carteira
 *     responses:
 *       200:
 *         description: Informações da carteira
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     wallet:
 *                       $ref: '#/components/schemas/Wallet'
 *       400:
 *         description: ID da carteira inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Carteira não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/wallets/:walletId',
  smartContractLimiter,
  authMiddleware,
  validateWalletId,
  SmartContractController.getWallet
);

/**
 * @swagger
 * /api/v1/smart-contract/transaction:
 *   post:
 *     summary: Executar transação no smart contract
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - contractMethod
 *             properties:
 *               walletId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: ID da carteira conectada
 *               contractMethod:
 *                 type: string
 *                 pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
 *                 example: "transfer"
 *                 description: Nome do método do contrato
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["0x742d35Cc6634C0532925a3b8D0C9e3e4c4c4c4c4", "1000"]
 *                 description: Parâmetros para o método do contrato
 *     responses:
 *       200:
 *         description: Transação executada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Transação executada com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Limite de transações excedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Limite de transações excedido. Tente novamente em 5 minutos."
 */
router.post('/transaction',
  transactionLimiter,
  authMiddleware,
  validateTransaction,
  SmartContractController.executeTransaction
);

/**
 * @swagger
 * /api/v1/smart-contract/health:
 *   get:
 *     summary: Verificar status de saúde do serviço de smart contract
 *     tags: [Smart Contracts]
 *     responses:
 *       200:
 *         description: Serviço operacional
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Serviço de smart contract operacional"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart contract service operational',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

module.exports = router;