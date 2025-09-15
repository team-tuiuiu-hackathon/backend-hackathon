const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');

// Importação de rotas
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const hackathonRoutes = require('./routes/hackathonRoutes');

// Importação de middleware de erro
const errorHandler = require('./middleware/errorHandler');

// Configuração das variáveis de ambiente
dotenv.config();

// Inicialização do app Express
const app = express();

// Middleware para parsing do corpo da requisição
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Middleware para CORS
app.use(cors());

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

// Middleware para tratamento de erros
app.use(errorHandler);

module.exports = app;