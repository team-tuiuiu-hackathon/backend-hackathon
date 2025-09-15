const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

/**
 * Conecta a um banco de dados MongoDB em memória para testes
 */
const connectMockDB = async () => {
  try {
    // Cria uma instância do MongoDB em memória
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB em memória conectado: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Erro ao conectar ao MongoDB em memória: ${error.message}`);
    console.log('Continuando sem conexão com o banco de dados...');
    return null;
  }
};

/**
 * Desconecta e encerra o MongoDB em memória
 */
const closeMockDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongod) {
      await mongod.stop();
    }
    console.log('MongoDB em memória desconectado');
  } catch (error) {
    console.error(`Erro ao desconectar MongoDB em memória: ${error.message}`);
  }
};

module.exports = { connectMockDB, closeMockDB };