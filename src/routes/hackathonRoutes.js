const express = require('express');
const hackathonController = require('../controllers/hackathonController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/hackathons:
 *   get:
 *     summary: Listar todos os hackathons
 *     tags: [Hackathons]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite de resultados por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, active, completed]
 *         description: Filtrar por status
 *     responses:
 *       200:
 *         description: Lista de hackathons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     hackathons:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Hackathon'
 */
router.get('/', hackathonController.getAllHackathons);

/**
 * @swagger
 * /api/v1/hackathons/{id}:
 *   get:
 *     summary: Obter hackathon por ID
 *     tags: [Hackathons]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do hackathon
 *     responses:
 *       200:
 *         description: Dados do hackathon
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
 *                     hackathon:
 *                       $ref: '#/components/schemas/Hackathon'
 *       404:
 *         description: Hackathon não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', hackathonController.getHackathon);

// Rotas protegidas
router.use(protect);

/**
 * @swagger
 * /api/v1/hackathons:
 *   post:
 *     summary: Criar novo hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - startDate
 *               - endDate
 *               - maxParticipants
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Hackathon Blockchain 2024"
 *               description:
 *                 type: string
 *                 example: "Desenvolva soluções inovadoras usando blockchain"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-01T09:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-03T18:00:00.000Z"
 *               maxParticipants:
 *                 type: integer
 *                 example: 100
 *               prizes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["1º lugar: R$ 10.000", "2º lugar: R$ 5.000"]
 *               rules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Equipes de até 5 pessoas", "Código deve ser original"]
 *     responses:
 *       201:
 *         description: Hackathon criado com sucesso
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
 *                     hackathon:
 *                       $ref: '#/components/schemas/Hackathon'
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
 */
router.post('/', hackathonController.createHackathon);

/**
 * @swagger
 * /api/v1/hackathons/{id}:
 *   patch:
 *     summary: Atualizar hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do hackathon
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               maxParticipants:
 *                 type: integer
 *               prizes:
 *                 type: array
 *                 items:
 *                   type: string
 *               rules:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Hackathon atualizado com sucesso
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
 *                     hackathon:
 *                       $ref: '#/components/schemas/Hackathon'
 *       404:
 *         description: Hackathon não encontrado
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
router.patch('/:id', hackathonController.updateHackathon);

/**
 * @swagger
 * /api/v1/hackathons/{id}:
 *   delete:
 *     summary: Deletar hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do hackathon
 *     responses:
 *       204:
 *         description: Hackathon deletado com sucesso
 *       404:
 *         description: Hackathon não encontrado
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
router.delete('/:id', hackathonController.deleteHackathon);

/**
 * @swagger
 * /api/v1/hackathons/{id}/register:
 *   post:
 *     summary: Registrar-se em um hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do hackathon
 *     responses:
 *       200:
 *         description: Registro realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: "Registrado com sucesso no hackathon"
 *       400:
 *         description: Erro no registro (hackathon lotado, já registrado, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Hackathon não encontrado
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
router.post('/:id/register', hackathonController.registerForHackathon);

/**
 * @swagger
 * /api/v1/hackathons/{id}/teams:
 *   post:
 *     summary: Criar equipe em um hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do hackathon
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Team Blockchain Warriors"
 *               description:
 *                 type: string
 *                 example: "Equipe focada em soluções DeFi"
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user1@example.com", "user2@example.com"]
 *     responses:
 *       201:
 *         description: Equipe criada com sucesso
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
 *                     team:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                         members:
 *                           type: array
 *                           items:
 *                             type: string
 *                         hackathon:
 *                           type: string
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Hackathon não encontrado
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
router.post('/:id/teams', hackathonController.createTeam);

module.exports = router;