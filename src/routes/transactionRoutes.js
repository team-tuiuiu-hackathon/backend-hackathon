const express = require('express');
const { body, param, query } = require('express-validator');
const TransactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/authMiddleware').protect;
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting para transações
const transactionLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 transações por 15 minutos
  message: {
    status: 'error',
    message: 'Muitas operações de transação. Tente novamente em 15 minutos.'
  }
});

const signatureLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // máximo 20 assinaturas por 5 minutos
  message: {
    status: 'error',
    message: 'Muitas tentativas de assinatura. Tente novamente em 5 minutos.'
  }
});

// Validações para propor transação
const proposeTransactionValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido'),
  
  body('type')
    .isIn(['payment', 'deposit', 'division', 'configuration'])
    .withMessage('Tipo de transação deve ser payment, deposit, division ou configuration'),
  
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor deve ser um número positivo'),
  
  body('currency')
    .optional()
    .isIn(['USDC', 'XLM'])
    .withMessage('Moeda deve ser USDC ou XLM'),
  
  body('recipient.address')
    .if(body('type').equals('payment'))
    .notEmpty()
    .withMessage('Endereço do destinatário é obrigatório para pagamentos'),
  
  body('recipient.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nome do destinatário deve ter no máximo 100 caracteres'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata deve ser um objeto válido')
];

// Validações para assinar transação
const signTransactionValidation = [
  param('transactionId')
    .isMongoId()
    .withMessage('ID da transação deve ser válido'),
  
  body('signature')
    .notEmpty()
    .isLength({ min: 10 })
    .withMessage('Assinatura deve ser válida'),
  
  body('publicKey')
    .notEmpty()
    .isLength({ min: 10 })
    .withMessage('Chave pública deve ser válida')
];

// Validações para executar transação
const executeTransactionValidation = [
  param('transactionId')
    .isMongoId()
    .withMessage('ID da transação deve ser válido'),
  
  body('txHash')
    .notEmpty()
    .withMessage('Hash da transação é obrigatório'),
  
  body('blockNumber')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Número do bloco deve ser um inteiro positivo'),
  
  body('gasUsed')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Gas usado deve ser um inteiro positivo')
];

// Validações para rejeitar transação
const rejectTransactionValidation = [
  param('transactionId')
    .isMongoId()
    .withMessage('ID da transação deve ser válido'),
  
  body('reason')
    .notEmpty()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Motivo da rejeição deve ter entre 10 e 500 caracteres')
];

// Validações para parâmetros de carteira
const walletParamValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido')
];

// Validações para parâmetros de transação
const transactionParamValidation = [
  param('transactionId')
    .isMongoId()
    .withMessage('ID da transação deve ser válido')
];

// Validações para query parameters de listagem
const getTransactionsValidation = [
  param('walletId')
    .isMongoId()
    .withMessage('ID da carteira deve ser válido'),
  
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'executed', 'rejected', 'expired'])
    .withMessage('Status deve ser pending, approved, executed, rejected ou expired'),
  
  query('type')
    .optional()
    .isIn(['payment', 'deposit', 'division', 'configuration'])
    .withMessage('Tipo deve ser payment, deposit, division ou configuration'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro maior que 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit deve ser um número entre 1 e 100'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'amount', 'status', 'type'])
    .withMessage('SortBy deve ser createdAt, amount, status ou type'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder deve ser asc ou desc')
];

// Aplicar autenticação a todas as rotas
router.use(authMiddleware);

// Rotas para transações

// BE06 - Propor uma transação
router.post('/wallets/:walletId/transactions',
  transactionLimit,
  proposeTransactionValidation,
  TransactionController.proposeTransaction
);

// BE07 - Listar transações de uma carteira
router.get('/wallets/:walletId/transactions',
  transactionLimit,
  getTransactionsValidation,
  TransactionController.getWalletTransactions
);

// Obter estatísticas de transações da carteira
router.get('/wallets/:walletId/transactions/stats',
  transactionLimit,
  walletParamValidation,
  TransactionController.getWalletTransactionStats
);

// Obter detalhes de uma transação específica
router.get('/transactions/:transactionId',
  transactionLimit,
  transactionParamValidation,
  TransactionController.getTransactionDetails
);

// BE08 - Assinar uma transação
router.post('/transactions/:transactionId/sign',
  signatureLimit,
  signTransactionValidation,
  TransactionController.signTransaction
);

// BE09 - Executar transação aprovada
router.post('/transactions/:transactionId/execute',
  transactionLimit,
  executeTransactionValidation,
  TransactionController.executeTransaction
);

// Rejeitar uma transação (apenas admins)
router.post('/transactions/:transactionId/reject',
  transactionLimit,
  rejectTransactionValidation,
  TransactionController.rejectTransaction
);

// Middleware de tratamento de erros específico para transações
router.use((error, req, res, next) => {
  // Log do erro para auditoria
  console.error('Erro em operação de transação:', {
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

  // Erro de cast (ID inválido)
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID fornecido é inválido'
    });
  }

  // Erros de negócio específicos de transações
  if (error.message.includes('saldo insuficiente') ||
      error.message.includes('já assinou') ||
      error.message.includes('expirada') ||
      error.message.includes('não está pendente')) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  // Erros de permissão
  if (error.message.includes('não é participante') ||
      error.message.includes('apenas administradores') ||
      error.message.includes('acesso negado')) {
    return res.status(403).json({
      status: 'error',
      message: error.message
    });
  }

  // Passar para o middleware de erro global
  next(error);
});

module.exports = router;