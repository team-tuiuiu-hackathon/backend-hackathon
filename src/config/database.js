const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente
dotenv.config();

/**
 * Configuração do banco de dados PostgreSQL usando Sequelize
 */
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

/**
 * Conecta ao banco de dados PostgreSQL
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL conectado com sucesso!');
    
    // Sincroniza os modelos com o banco de dados
    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados com o banco de dados');
    
    return sequelize;
  } catch (error) {
    console.error(`Erro ao conectar ao PostgreSQL: ${error.message}`);
    console.log('Continuando sem conexão com o banco de dados...');
    return null;
  }
};

module.exports = { connectDB, sequelize };