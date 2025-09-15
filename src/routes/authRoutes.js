const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Rotas públicas
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Rotas protegidas
router.patch('/updateMyPassword', protect, authController.updatePassword);

module.exports = router;