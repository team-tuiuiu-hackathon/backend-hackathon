const app = require('./app.js');
const dotenv = require('dotenv');
const { initializeSequelize } = require('./config/sequelizeConfig');

// Configuração das variáveis de ambiente
dotenv.config();

// Porta do servidor
const port = process.env.PORT || 3000;

// Função para inicializar o servidor
const startServer = async () => {
  try {
    // Inicialização do Sequelize
    const sequelize = initializeSequelize();
    if (sequelize) {
      console.log('Banco de dados conectado com sucesso');
    } else {
      console.log('Usando modelos mock devido à falha na conexão com o banco');
    }
    
    // Inicialização do servidor
    const server = app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port} em modo ${process.env.NODE_ENV || 'development'}`);
    });

    // Tratamento de exceções não tratadas
    process.on('unhandledRejection', (err) => {
      console.error('ERRO NÃO TRATADO! 💥 Encerrando...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEBIDO. Encerrando graciosamente');
      server.close(() => {
        console.log('💥 Processo encerrado!');
      });
    });

  } catch (error) {
    console.error('Erro ao inicializar o servidor:', error);
    process.exit(1);
  }
};

// Inicializar o servidor
startServer();