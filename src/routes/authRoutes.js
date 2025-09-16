const express = require('express');
const web3AuthController = require('../controllers/web3AuthController');

const router = express.Router();

// ==================== ROTAS WEB3 ====================

/**
 * @swagger
 * /api/v1/auth/web3/nonce:
 *   post:
 *     summary: Gerar nonce para autenticação Web3
 *     tags: [Autenticação Web3]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6634C0532925a3b8D4C2C4e4C4C4C4C4"
 *                 description: "Endereço da carteira Ethereum"
 *     responses:
 *       200:
 *         description: Nonce gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     nonce:
 *                       type: string
 *                       example: "a1b2c3d4e5f6..."
 *                     message:
 *                       type: string
 *                       example: "Faça login na plataforma com sua carteira Web3..."
 *                     walletAddress:
 *                       type: string
 *                       example: "0x742d35cc6634c0532925a3b8d4c2c4e4c4c4c4c4"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Endereço da carteira inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/web3/nonce', web3AuthController.generateNonce);

/**
 * @swagger
 * /api/v1/auth/web3/verify:
 *   post:
 *     summary: Verificar assinatura e fazer login Web3
 *     tags: [Autenticação Web3]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - signature
 *               - nonce
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6634C0532925a3b8D4C2C4e4C4C4C4C4"
 *                 description: "Endereço da carteira Ethereum"
 *               signature:
 *                 type: string
 *                 example: "0x1234567890abcdef..."
 *                 description: "Assinatura da mensagem"
 *               nonce:
 *                 type: string
 *                 example: "a1b2c3d4e5f6..."
 *                 description: "Nonce gerado anteriormente"
 *     responses:
 *       200:
 *         description: Login Web3 realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/Web3User'
 *       401:
 *         description: Assinatura inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Dados inválidos ou nonce expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/web3/verify', web3AuthController.verifySignature);

/**
 * @swagger
 * /api/v1/auth/web3/me:
 *   get:
 *     summary: Obter dados do usuário autenticado
 *     tags: [Autenticação Web3]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/Web3User'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/web3/me', web3AuthController.protect, web3AuthController.getMe);

/**
 * @swagger
 * /api/v1/auth/web3/profile:
 *   patch:
 *     summary: Atualizar perfil do usuário Web3
 *     tags: [Autenticação Web3]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@example.com"
 *               bio:
 *                 type: string
 *                 example: "Desenvolvedor blockchain"
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/Web3User'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/web3/profile', web3AuthController.protect, web3AuthController.updateProfile);

module.exports = router;