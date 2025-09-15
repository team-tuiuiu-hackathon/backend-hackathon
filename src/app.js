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

// Rotas de demonstração (quando não há banco de dados)
if (process.env.SKIP_DB === 'true') {
  console.log('Configurando rotas de demonstração...');
  
  // Dados de exemplo
  const demoHackathons = [
    {
      id: '1',
      title: 'Hackathon de Inovação',
      description: 'Um evento para desenvolver soluções inovadoras',
      startDate: '2023-12-01',
      endDate: '2023-12-03',
      location: 'São Paulo, SP',
      prizes: ['R$ 10.000', 'Mentoria com especialistas', 'Incubação do projeto'],
      status: 'upcoming'
    },
    {
      id: '2',
      title: 'Hackathon de Sustentabilidade',
      description: 'Desenvolva soluções para um futuro sustentável',
      startDate: '2024-01-15',
      endDate: '2024-01-17',
      location: 'Rio de Janeiro, RJ',
      prizes: ['R$ 15.000', 'Parceria com investidores', 'Curso de empreendedorismo'],
      status: 'open'
    }
  ];
  
  const demoUsers = [
    {
      id: '1',
      name: 'Usuário Demo',
      email: 'demo@example.com',
      role: 'user'
    },
    {
      id: '2',
      name: 'Admin Demo',
      email: 'admin@example.com',
      role: 'admin'
    }
  ];
  
  // Rotas de demonstração para hackathons
  app.get(`${API_PREFIX}/demo/hackathons`, (req, res) => {
    res.status(200).json({
      status: 'success',
      results: demoHackathons.length,
      data: {
        hackathons: demoHackathons
      }
    });
  });
  
  app.get(`${API_PREFIX}/demo/hackathons/:id`, (req, res) => {
    const hackathon = demoHackathons.find(h => h.id === req.params.id);
    if (!hackathon) {
      return res.status(404).json({
        status: 'fail',
        message: 'Hackathon não encontrado'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        hackathon
      }
    });
  });
  
  // Rotas de demonstração para usuários
  app.get(`${API_PREFIX}/demo/users`, (req, res) => {
    res.status(200).json({
      status: 'success',
      results: demoUsers.length,
      data: {
        users: demoUsers
      }
    });
  });
  
  // Rota de demonstração para login
  app.post(`${API_PREFIX}/demo/login`, (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Por favor, forneça email e senha'
      });
    }
    
    res.status(200).json({
      status: 'success',
      token: 'demo-jwt-token',
      data: {
        user: demoUsers[0]
      }
    });
  });
}

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