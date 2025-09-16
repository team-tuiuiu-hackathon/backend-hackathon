const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Importação de rotas
const depositRoutes = require('./routes/depositRoutes');
const fundSplitRoutes = require('./routes/fundSplitRoutes');
const multisigWalletRoutes = require('./routes/multisigWalletRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const stellarAuthRoutes = require('./routes/stellarAuthRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

// Importação de middlewares
const errorHandler = require('./middleware/errorHandler');

// Criação da aplicação Express
const app = express();

// Middlewares de segurança e configuração
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Documentação da API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rota de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rotas da API
app.use('/api/deposits', depositRoutes);
app.use('/api/fund-splits', fundSplitRoutes);
app.use('/api/multisig-wallets', multisigWalletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stellar-auth', stellarAuthRoutes);
app.use('/api/transactions', transactionRoutes);

// Rota padrão
app.get('/', (req, res) => {
  res.json({
    message: 'Backend Hackathon API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

module.exports = app;