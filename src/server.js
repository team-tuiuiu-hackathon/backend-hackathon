const app = require('./app');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');

// Configuração das variáveis de ambiente
dotenv.config();

// Porta do servidor
const port = process.env.PORT || 3000;

// Conexão com o banco de dados
connectDB();

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