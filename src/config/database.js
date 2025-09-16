const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente
dotenv.config();

/**
 * Configuração do banco de dados PostgreSQL usando Sequelize
 */
let sequelize = null;

// String de conexão do banco PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_9cvhVA1tPGQj@ep-orange-forest-ac8jacpr-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Cria a instância do Sequelize com a configuração do banco
sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 2,
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
    throw error; // Lança o erro para que a aplicação não continue sem banco
  }
};

module.exports = { connectDB, sequelize };