const express = require('express');
const { body, param, query } = require('express-validator');
const MultisigWalletController = require('../controllers/multisigWalletController');
const authMiddleware = require('../middleware/authMiddleware').protect;
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting específico para operações de carteira
const walletCreationLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 carteiras por hora por IP
  message: {
    status: 'error',
    message: 'Muitas tentativas de criação de carteira. Tente novamente em 1 hora.'
  }
});

const walletOperationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 operações por 15 minutos
  message: {
    status: 'error',
    message: 'Muitas operações de carteira. Tente novamente em 15 minutos.'
  }
});

// Validações para criação de carteira
const createWalletValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome deve ter entre 3 e 100 caracteres'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres'),
  
  body('threshold')
    .isInt({ min: 1 })
    .withMessage('Threshold deve ser um número inteiro maior que 0'),
  
  body('participants')
    .isArray({ min: 1 })
    .withMessage('Deve haver pelo menos um participante'),
  
  body('participants.*.userId')
    .isMongoId()
    .withMessage('ID do usuário deve ser válido'),
  
  body('participants.*.publicKey')
    .isLength({ min: 10 })
    .withMessage('Chave pública deve ser válida'),
  
  body('participants.*.role')
    .optional()
    .isIn(['admin', 'participant'])
    .withMessage('Role deve ser admin ou participant'),
  
  body('contractAddress')
    .isLength({ min: 10 })
    .withMessage('Endereço do contrato deve ser válido')
];

// Validações para atualização de threshold
const updateThresholdValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido'),
  
  body('threshold')
    .isInt({ min: 1 })
    .withMessage('Threshold deve ser um número inteiro maior que 0')
];

// Validações para adicionar participante
const addParticipantValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido'),
  
  body('userId')
    .isMongoId()
    .withMessage('ID do usuário deve ser válido'),
  
  body('publicKey')
    .isLength({ min: 10 })
    .withMessage('Chave pública deve ser válida'),
  
  body('role')
    .optional()
    .isIn(['admin', 'participant'])
    .withMessage('Role deve ser admin ou participant')
];

// Validações para parâmetros de carteira
const walletParamValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido')
];

// Validações para remover participante
const removeParticipantValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido'),
  
  param('userId')
    .isMongoId()
    .withMessage('ID do usuário deve ser válido')
];

// Validações para atualizar carteira
const updateWalletValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome deve ter entre 3 e 100 caracteres'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres')
];

// Validações para query parameters
const getUserWalletsValidation = [
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status deve ser active, inactive ou suspended'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro maior que 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit deve ser um número entre 1 e 100')
];

// Aplicar autenticação a todas as rotas
router.use(authMiddleware);

// Rotas para carteiras multisig

// BE01 - Criar carteira multisig
router.post('/', 
  walletCreationLimit,
  createWalletValidation,
  MultisigWalletController.createWallet
);

// Listar carteiras do usuário
router.get('/',
  walletOperationLimit,
  getUserWalletsValidation,
  MultisigWalletController.getUserWallets
);

// Obter detalhes de uma carteira específica
router.get('/:walletId',
  walletOperationLimit,
  walletParamValidation,
  MultisigWalletController.getWalletDetails
);

// Atualizar informações básicas da carteira
router.put('/:walletId',
  walletOperationLimit,
  updateWalletValidation,
  MultisigWalletController.updateWallet
);

// BE02 - Atualizar threshold de assinaturas
router.patch('/:walletId/threshold',
  walletOperationLimit,
  updateThresholdValidation,
  MultisigWalletController.updateThreshold
);

// BE04 - Listar membros da carteira
router.get('/:walletId/members',
  walletOperationLimit,
  walletParamValidation,
  MultisigWalletController.getWalletMembers
);

// BE03 - Adicionar participante
router.post('/:walletId/participants',
  walletOperationLimit,
  addParticipantValidation,
  MultisigWalletController.addParticipant
);

// BE03 - Remover participante
router.delete('/:walletId/participants/:userId',
  walletOperationLimit,
  removeParticipantValidation,
  MultisigWalletController.removeParticipant
);

// Middleware de tratamento de erros específico para carteiras
router.use((error, req, res, next) => {
  // Log do erro para auditoria
  console.error('Erro em operação de carteira multisig:', {
    error: error.message,
    stack: error.stack,
    user: req.user?.id,
    method: req.method,
    path: req.path,
    body: req.body,
    params: req.params,
    timestamp: new Date().toISOString()
  });

  // Erros específicos de validação do Mongoose
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    
    return res.status(400).json({
      status: 'error',
      message: 'Erro de validação',
      errors
    });
  }

  // Erro de duplicação (chave única)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json({
      status: 'error',
      message: `${field} já existe no sistema`
    });
  }

  // Erro de cast (ID inválido)
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID fornecido é inválido'
    });
  }

  // Passar para o middleware de erro global
  next(error);
});

module.exports = router;