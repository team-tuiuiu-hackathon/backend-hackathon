const app = require('./app');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Configuração das variáveis de ambiente
dotenv.config();

// Definição da porta
const port = process.env.PORT || 3001; // Alterado para porta 3001 para evitar conflitos

// Conexão com o banco de dados
if (process.env.SKIP_DB === 'true') {
  console.log('Modo de demonstração: Executando sem banco de dados...');
} else {
  try {
    connectDB();
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error.message);
    console.log('Continuando sem banco de dados para demonstração...');
  }
}

// Inicialização do servidor
const server = app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port} em modo ${process.env.NODE_ENV}`);
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