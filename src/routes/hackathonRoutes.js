const express = require('express');
const hackathonController = require('../controllers/hackathonController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// Rotas públicas
router.get('/', hackathonController.getAllHackathons);
router.get('/:id', hackathonController.getHackathon);

// Rotas protegidas
router.use(protect);

router.post('/', hackathonController.createHackathon);
router.patch('/:id', hackathonController.updateHackathon);
router.delete('/:id', hackathonController.deleteHackathon);

// Rotas para participantes
router.post('/:id/register', hackathonController.registerForHackathon);
router.post('/:id/teams', hackathonController.createTeam);

module.exports = router;