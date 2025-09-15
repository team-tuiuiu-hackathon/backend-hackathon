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

// Importação de middleware de erro
const errorHandler = require('./middleware/errorHandler');
const SmartContractMiddleware = require('./middleware/smartContractMiddleware');

// Importação do Swagger
const { specs, swaggerUi } = require('./config/swagger');

// Configuração das variáveis de ambiente
dotenv.config();

// Inicialização do app Express
const app = express();

// Middleware de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
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

// Middleware for request body parsing
app.use(express.json({ 
  limit: '10kb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ status: 'error', message: 'Invalid JSON' });
      return;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Middleware for CORS with more secure configurations
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware for logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API prefix
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Backend Hackathon API Documentation'
}));

// Routes
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/hackathons`, hackathonRoutes);
app.use(`${API_PREFIX}/smart-contract`, 
  SmartContractMiddleware.sanitizeInput,
  SmartContractMiddleware.logActivity,
  smartContractRoutes
);

// Route to check if the API is working
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend Hackathon API is working!',
  });
});



// Middleware for routes not found
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Could not find ${req.originalUrl} on this server!`,
  });
});

// Middleware for smart contract specific error handling
app.use('/api/*/smart-contract', SmartContractMiddleware.handleSmartContractErrors);

// Middleware for error handling
app.use(errorHandler);

module.exports = app;