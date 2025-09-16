const express = require('express');
const { body } = require('express-validator');
const {
  generateStellarChallenge,
  stellarLogin,
  protectStellar,
  getStellarMe
} = require('../controllers/stellarAuthController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StellarChallenge:
 *       type: object
 *       required:
 *         - publicKey
 *       properties:
 *         publicKey:
 *           type: string
 *           description: Chave pública Stellar (56 caracteres)
 *           example: "GCKFBEIYTKP6JY4Q2FBJCGK6YBWKX7NQQQIWXQYN7XJHVQZQZQZQZQZQ"
 *     
 *     StellarLogin:
 *       type: object
 *       required:
 *         - signedXDR
 *       properties:
 *         signedXDR:
 *           type: string
 *           description: XDR da transação assinada pelo usuário
 *           example: "AAAAAgAAAABelb7j..."
 *     
 *     StellarUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do usuário
 *         address:
 *           type: string
 *           description: Endereço Stellar do usuário
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Data do último login
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação da conta
 */

/**
 * @swagger
 * /api/stellar/challenge:
 *   post:
 *     summary: Gera um challenge para autenticação Stellar
 *     tags: [Stellar Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StellarChallenge'
 *     responses:
 *       200:
 *         description: Challenge gerado com sucesso
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
 *                     transactionXDR:
 *                       type: string
 *                       description: XDR da transação não assinada
 *                     challenge:
 *                       type: string
 *                       description: Challenge gerado
 *                     expiresIn:
 *                       type: number
 *                       description: Tempo de expiração em segundos
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/challenge', [
  body('publicKey')
    .notEmpty()
    .withMessage('publicKey é obrigatória')
    .isLength({ min: 56, max: 56 })
    .withMessage('publicKey deve ter exatamente 56 caracteres')
    .matches(/^G[A-Z2-7]{55}$/)
    .withMessage('publicKey deve ser um endereço Stellar válido')
], generateStellarChallenge);

/**
 * @swagger
 * /api/stellar/login:
 *   post:
 *     summary: Autentica usuário com transação Stellar assinada
 *     tags: [Stellar Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StellarLogin'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
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
 *                   description: Token JWT para autenticação
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/StellarUser'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Falha na autenticação
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/login', [
  body('signedXDR')
    .notEmpty()
    .withMessage('signedXDR é obrigatório')
], stellarLogin);

/**
 * @swagger
 * /api/stellar/me:
 *   get:
 *     summary: Retorna informações do usuário autenticado
 *     tags: [Stellar Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário retornados com sucesso
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
 *                       $ref: '#/components/schemas/StellarUser'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/me', protectStellar, getStellarMe);

module.exports = router;