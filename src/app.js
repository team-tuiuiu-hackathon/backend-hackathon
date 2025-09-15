const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Importação de rotas
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const hackathonRoutes = require('./routes/hackathonRoutes');
const smartContractRoutes = require('./routes/smartContractRoutes');
const multisigWalletRoutes = require('./routes/multisigWalletRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const depositRoutes = require('./routes/depositRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const fundSplitRoutes = require('./routes/fundSplitRoutes');

// Importação de middleware de erro
const errorHandler = require('./middleware/errorHandler');
const SmartContractMiddleware = require('./middleware/smartContractMiddleware');

// Configuração das variáveis de ambiente
dotenv.config();

// Inicialização do app Express
const app = express();

// Middleware de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP por janela de tempo
  message: {
    status: 'error',
    message: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Middleware para parsing do corpo da requisição
app.use(express.json({ 
  limit: '10kb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ status: 'error', message: 'JSON inválido' });
      return;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Middleware para CORS com configurações mais seguras
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware para logging em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Prefixo da API
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Rotas
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/hackathons`, hackathonRoutes);
app.use(`${API_PREFIX}/wallets`, multisigWalletRoutes);
app.use(`${API_PREFIX}`, transactionRoutes);
app.use(`${API_PREFIX}`, depositRoutes);
app.use(`${API_PREFIX}`, paymentRoutes);
app.use(`${API_PREFIX}`, fundSplitRoutes);
app.use(`${API_PREFIX}/smart-contract`, 
  SmartContractMiddleware.sanitizeInput,
  SmartContractMiddleware.logActivity,
  smartContractRoutes
);

// Rota para verificar se a API está funcionando
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API Backend Hackathon funcionando!',
  });
});



// Middleware para rotas não encontradas
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Não foi possível encontrar ${req.originalUrl} neste servidor!`,
  });
});

// Middleware de tratamento de erros específicos de smart contract
app.use('/api/*/smart-contract', SmartContractMiddleware.handleSmartContractErrors);

// Middleware para tratamento de erros
app.use(errorHandler);

module.exports = app;