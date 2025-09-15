const { Sequelize } = require('sequelize');

/**
 * Configuração do banco de dados para testes usando SQLite em memória
 */
const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  sync: { force: true }
});

/**
 * Conecta ao banco de dados de teste
 */
const connectTestDB = async () => {
  try {
    await testSequelize.authenticate();
    console.log('Banco de dados de teste conectado (SQLite em memória)');
    
    // Sincroniza os modelos com o banco de dados
    await testSequelize.sync({ force: true });
    console.log('Modelos sincronizados com o banco de teste');
    
    return testSequelize;
  } catch (error) {
    console.error(`Erro ao conectar ao banco de teste: ${error.message}`);
    throw error;
  }
};

module.exports = { connectTestDB, testSequelize };