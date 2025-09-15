const express = require('express');
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// Rotas protegidas para o usuário atual
router.use(protect);

router.patch('/updateMe', userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);

// Rotas restritas a administradores
router.use(restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;