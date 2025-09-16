const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const MultisigWalletController = require('../controllers/multisigWalletController');
// const authMiddleware = require('../middleware/authMiddleware').protect;
const rateLimit = require('express-rate-limit');
const WalletPermissionMiddleware = require('../middleware/walletPermissions');

// Middleware para validação de requisições
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Dados de entrada inválidos',
      errors: errors.array()
    });
  }
  next();
};

// Middleware para validar acesso à carteira
const validateWalletAccess = async (req, res, next) => {
  try {
    // Implementação simplificada - pode ser expandida conforme necessário
    next();
  } catch (error) {
    res.status(403).json({
      status: 'error',
      message: 'Acesso negado à carteira'
    });
  }
};

// Middleware para verificar permissões específicas da carteira
const requireWalletPermission = (permission) => {
  return (req, res, next) => {
    // Implementação simplificada - pode ser expandida conforme necessário
    next();
  };
};

const router = express.Router();

// Rate limiting específico para operações de carteira
// Rate limiting middleware
const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 operações por 15 minutos
  message: {
    status: 'error',
    message: 'Muitas operações. Tente novamente em 15 minutos.'
  }
});

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

// Validações para atualizar threshold
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
// router.use(authMiddleware);

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

// Rotas administrativas avançadas

// Atualizar configurações administrativas
router.patch('/:walletId/admin/settings',
  walletOperationLimit,
  WalletPermissionMiddleware.checkPermission('modify_settings'),
  MultisigWalletController.updateAdminSettings
);

// Atualizar role de participante
router.patch('/:walletId/participants/:userId/role',
  walletOperationLimit,
  WalletPermissionMiddleware.requireAdmin(),
  MultisigWalletController.updateParticipantRole
);

// Configurar limites da carteira
router.patch('/:walletId/limits',
  walletOperationLimit,
  WalletPermissionMiddleware.checkPermission('modify_settings'),
  MultisigWalletController.updateWalletLimits
);

// Configurar regras de divisão de fundos
router.patch('/:walletId/division-rules',
  walletOperationLimit,
  WalletPermissionMiddleware.checkPermission('modify_settings'),
  MultisigWalletController.updateDivisionRules
);

// Alterar status da carteira
router.patch('/:walletId/status',
  walletOperationLimit,
  WalletPermissionMiddleware.requireSuperAdmin(),
  MultisigWalletController.updateWalletStatus
);

// Obter estatísticas administrativas
router.get('/:walletId/admin/statistics',
  walletOperationLimit,
  WalletPermissionMiddleware.requireAdmin(),
  MultisigWalletController.getAdminStatistics
);

// Rotas para usuários criarem e gerenciarem carteiras

// Criar nova carteira compartilhada
router.post('/create',
  // authMiddleware,
  walletOperationLimit,
  [
    body('name').isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),
    body('threshold').isInt({ min: 1 }).withMessage('Threshold deve ser um número positivo'),
    body('participants').isArray({ min: 2 }).withMessage('Deve ter pelo menos 2 participantes')
  ],
  MultisigWalletController.createUserWallet
);

// Listar carteiras do usuário
router.get('/my-wallets',
  // authMiddleware,
  walletOperationLimit,
  MultisigWalletController.getUserWallets
);

// Convidar participantes para carteira
router.post('/:walletId/invite',
  // authMiddleware,
  walletOperationLimit,
  WalletPermissionMiddleware.checkPermission('invite_participants'),
  [
    body('participants').isArray({ min: 1 }).withMessage('Lista de participantes é obrigatória')
  ],
  MultisigWalletController.inviteParticipants
);

// Aceitar convite de carteira
router.post('/:walletId/accept-invite',
  // authMiddleware,
  walletOperationLimit,
  [
    body('acceptTerms').isBoolean().withMessage('Aceitação dos termos é obrigatória')
  ],
  MultisigWalletController.acceptWalletInvite
);

// Atualizar informações básicas da carteira
router.patch('/:walletId/update',
  // authMiddleware,
  walletOperationLimit,
  WalletPermissionMiddleware.requireAdmin(),
  [
    body('name').optional().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),
    body('description').optional().isString()
  ],
  MultisigWalletController.updateWallet
);

// Rotas de auditoria (apenas para administradores)
router.get('/:walletId/audit-logs', 
  // authMiddleware,
  rateLimitMiddleware,
  validateWalletAccess,
  requireWalletPermission('view_audit_logs'),
  MultisigWalletController.getWalletAuditLogs
);

router.get('/:walletId/audit-report', 
  // authMiddleware,
  rateLimitMiddleware,
  validateWalletAccess,
  requireWalletPermission('generate_reports'),
  [
    query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv'),
    query('startDate').optional().isISO8601().withMessage('Data de início inválida'),
    query('endDate').optional().isISO8601().withMessage('Data de fim inválida'),
    query('actions').optional().isArray().withMessage('Ações devem ser um array'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Severidade inválida')
  ],
  validateRequest,
  MultisigWalletController.generateAuditReport
);

// Rotas administrativas avançadas
router.post('/:walletId/emergency-freeze', 
  // authMiddleware,
  rateLimitMiddleware,
  validateWalletAccess,
  requireWalletPermission('emergency_actions'),
  [
    body('reason').notEmpty().withMessage('Motivo é obrigatório'),
    body('duration').optional().isInt({ min: 1, max: 168 }).withMessage('Duração deve ser entre 1 e 168 horas')
  ],
  validateRequest,
  MultisigWalletController.emergencyFreeze
);

router.post('/:walletId/emergency-unfreeze', 
  // authMiddleware,
  rateLimitMiddleware,
  validateWalletAccess,
  requireWalletPermission('emergency_actions'),
  [
    body('reason').notEmpty().withMessage('Motivo é obrigatório')
  ],
  validateRequest,
  MultisigWalletController.emergencyUnfreeze
);

router.post('/:walletId/bulk-update-permissions', 
  // authMiddleware,
  rateLimitMiddleware,
  validateWalletAccess,
  requireWalletPermission('manage_permissions'),
  [
    body('updates').isArray().withMessage('Updates deve ser um array'),
    body('updates.*.participantId').notEmpty().withMessage('ID do participante é obrigatório'),
    body('updates.*.permissions').isArray().withMessage('Permissões devem ser um array'),
    body('reason').notEmpty().withMessage('Motivo é obrigatório')
  ],
  validateRequest,
  MultisigWalletController.bulkUpdatePermissions
);

router.get('/:walletId/security-analysis', 
  // authMiddleware,
  rateLimitMiddleware,
  validateWalletAccess,
  requireWalletPermission('view_security_analysis'),
  MultisigWalletController.getSecurityAnalysis
);

module.exports = router;
