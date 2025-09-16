const { Sequelize } = require('sequelize');

let sequelize = null;

/**
 * Configuração do Sequelize para desenvolvimento
 * Usa SQLite em memória como fallback
 */
const initializeSequelize = () => {
  if (sequelize) {
    return sequelize;
  }

  try {
    // Tenta usar PostgreSQL se configurado
    if (process.env.DATABASE_URL) {
      sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
      });
    } else {
      // Fallback para SQLite em memória
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
      });
      console.log('Usando SQLite em memória como banco de dados');
    }
    
    return sequelize;
  } catch (error) {
    console.error('Erro ao inicializar Sequelize:', error.message);
    return null;
  }
};

/**
 * Conecta ao banco de dados
 */
const connectSequelize = async () => {
  const seq = initializeSequelize();
  if (!seq) return null;

  try {
    await seq.authenticate();
    console.log('Sequelize conectado com sucesso');
    
    // Sincroniza os modelos
    await seq.sync({ alter: true });
    console.log('Modelos sincronizados');
    
    return seq;
  } catch (error) {
    console.error('Erro ao conectar Sequelize:', error.message);
    return null;
  }
};

module.exports = {
  initializeSequelize,
  connectSequelize,
  getSequelize: () => sequelize
};