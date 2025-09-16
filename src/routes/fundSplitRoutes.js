const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const FundSplitController = require('../controllers/fundSplitController');
// const authMiddleware = require('../middleware/authMiddleware').protect;
const SmartContractMiddleware = require('../middleware/smartContractMiddleware');

const router = express.Router();
const fundSplitController = new FundSplitController();
const smartContractMiddleware = new SmartContractMiddleware();

// Rate limiting para operações de divisão de fundos
const fundSplitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 requests por IP por janela
  message: {
    status: 'error',
    message: 'Muitas tentativas de operações de divisão. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting mais restritivo para criação e modificação
const modificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 requests por IP por janela
  message: {
    status: 'error',
    message: 'Muitas tentativas de modificação. Tente novamente em 5 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validações para criação de regra
const createRuleValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome deve ter entre 3 e 100 caracteres')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Nome contém caracteres inválidos'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode exceder 500 caracteres'),
  
  body('walletId')
    .isMongoId()
    .withMessage('ID da carteira inválido'),
  
  body('ruleType')
    .isIn(['percentage', 'fixed_amount', 'priority_based'])
    .withMessage('Tipo de regra deve ser: percentage, fixed_amount ou priority_based'),
  
  body('priority')
    .isInt({ min: 1, max: 100 })
    .withMessage('Prioridade deve ser um número entre 1 e 100'),
  
  body('conditions.minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor mínimo deve ser um número positivo'),
  
  body('conditions.maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor máximo deve ser um número positivo'),
  
  body('conditions.triggerEvents')
    .optional()
    .isArray()
    .withMessage('Eventos de gatilho devem ser um array'),
  
  body('conditions.triggerEvents.*')
    .optional()
    .isIn(['deposit', 'payment_received', 'manual_trigger', 'scheduled'])
    .withMessage('Evento de gatilho inválido'),
  
  body('splitConfiguration')
    .isObject()
    .withMessage('Configuração de divisão é obrigatória'),
  
  body('advancedSettings.autoExecute')
    .optional()
    .isBoolean()
    .withMessage('Auto execução deve ser verdadeiro ou falso'),
  
  body('advancedSettings.maxExecutionsPerDay')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Máximo de execuções por dia deve ser entre 1 e 1000'),
  
  body('advancedSettings.cooldownPeriod')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Período de cooldown deve ser um número positivo'),
  
  body('advancedSettings.notificationSettings.onSuccess')
    .optional()
    .isBoolean()
    .withMessage('Notificação de sucesso deve ser verdadeiro ou falso'),
  
  body('advancedSettings.notificationSettings.onFailure')
    .optional()
    .isBoolean()
    .withMessage('Notificação de falha deve ser verdadeiro ou falso')
];

// Validações para atualização de regra
const updateRuleValidation = [
  param('ruleId')
    .isUUID()
    .withMessage('ID da regra deve ser um UUID válido'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome deve ter entre 3 e 100 caracteres')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Nome contém caracteres inválidos'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode exceder 500 caracteres'),
  
  body('priority')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Prioridade deve ser um número entre 1 e 100'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status deve ser: active, inactive ou suspended')
];

// Validações para parâmetros de rota
const ruleIdValidation = [
  param('ruleId')
    .isUUID()
    .withMessage('ID da regra deve ser um UUID válido')
];

const walletIdValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira inválido')
];

// Validações para simulação
const simulationValidation = [
  param('ruleId')
    .isUUID()
    .withMessage('ID da regra deve ser um UUID válido'),
  
  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Valor deve ser maior que zero')
    .custom((value) => {
      // Validar que o valor não excede o limite de USDC (6 casas decimais)
      const decimals = (value.toString().split('.')[1] || '').length;
      if (decimals > 6) {
        throw new Error('Valor não pode ter mais de 6 casas decimais');
      }
      return true;
    })
];

// Validações para alteração de status
const statusValidation = [
  param('ruleId')
    .isUUID()
    .withMessage('ID da regra deve ser um UUID válido'),
  
  body('status')
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status deve ser: active, inactive ou suspended')
];

// Validações para query parameters
const listValidation = [
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status deve ser: active, inactive ou suspended'),
  
  query('ruleType')
    .optional()
    .isIn(['percentage', 'fixed_amount', 'priority_based'])
    .withMessage('Tipo de regra inválido'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número positivo'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100')
];

// Aplicar middlewares globais
router.use(fundSplitLimiter);
// router.use(authMiddleware);
router.use(SmartContractMiddleware.sanitizeInput);

// === ROTAS DE REGRAS DE DIVISÃO ===

/**
 * @route POST /fund-split/rules
 * @desc Criar nova regra de divisão
 * @access Private
 */
router.post('/fund-split/rules',
  modificationLimiter,
  createRuleValidation,
  SmartContractMiddleware.validateAmount,
  (req, res) => fundSplitController.createRule(req, res)
);

/**
 * @route GET /fund-split/wallets/:walletId/rules
 * @desc Listar regras de divisão de uma carteira
 * @access Private
 */
router.get('/fund-split/wallets/:walletId/rules',
  walletIdValidation,
  listValidation,
  (req, res) => fundSplitController.listRules(req, res)
);

/**
 * @route GET /fund-split/rules/:ruleId
 * @desc Obter detalhes de uma regra específica
 * @access Private
 */
router.get('/fund-split/rules/:ruleId',
  ruleIdValidation,
  (req, res) => fundSplitController.getRule(req, res)
);

/**
 * @route PUT /fund-split/rules/:ruleId
 * @desc Atualizar regra de divisão
 * @access Private
 */
router.put('/fund-split/rules/:ruleId',
  modificationLimiter,
  updateRuleValidation,
  SmartContractMiddleware.validateAmount,
  (req, res) => fundSplitController.updateRule(req, res)
);

/**
 * @route DELETE /fund-split/rules/:ruleId
 * @desc Remover regra de divisão
 * @access Private
 */
router.delete('/fund-split/rules/:ruleId',
  modificationLimiter,
  ruleIdValidation,
  (req, res) => fundSplitController.deleteRule(req, res)
);

/**
 * @route PATCH /fund-split/rules/:ruleId/status
 * @desc Ativar/desativar regra de divisão
 * @access Private
 */
router.patch('/fund-split/rules/:ruleId/status',
  modificationLimiter,
  statusValidation,
  (req, res) => fundSplitController.toggleRuleStatus(req, res)
);

/**
 * @route GET /fund-split/rules/:ruleId/statistics
 * @desc Obter estatísticas de uma regra
 * @access Private
 */
router.get('/fund-split/rules/:ruleId/statistics',
  ruleIdValidation,
  (req, res) => fundSplitController.getRuleStatistics(req, res)
);

/**
 * @route POST /fund-split/rules/:ruleId/simulate
 * @desc Simular execução de uma regra
 * @access Private
 */
router.post('/fund-split/rules/:ruleId/simulate',
  simulationValidation,
  SmartContractMiddleware.validateAmount,
  (req, res) => fundSplitController.simulateRule(req, res)
);

/**
 * @route GET /fund-split/rules/:ruleId/executions
 * @desc Obter histórico de execuções de uma regra
 * @access Private
 */
router.get('/fund-split/rules/:ruleId/executions',
  ruleIdValidation,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100'),
  (req, res) => fundSplitController.getRuleExecutions(req, res)
);

// Middleware de tratamento de erros específico para fund split
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de divisão de fundos:', error);

  // Erro de validação do Mongoose
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Dados inválidos',
      errors
    });
  }

  // Erro de cast do Mongoose (ID inválido)
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID inválido fornecido'
    });
  }

  // Erro de duplicação
  if (error.code === 11000) {
    return res.status(409).json({
      status: 'error',
      message: 'Regra com este nome já existe para esta carteira'
    });
  }

  // Erro de rate limiting
  if (error.status === 429) {
    return res.status(429).json({
      status: 'error',
      message: 'Muitas tentativas. Tente novamente mais tarde.'
    });
  }

  // Erro genérico
  res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor'
  });
});

module.exports = router;
