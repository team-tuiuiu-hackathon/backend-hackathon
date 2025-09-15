const mongoose = require('mongoose');

/**
 * Conecta ao banco de dados MongoDB
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB conectado: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Erro ao conectar ao MongoDB: ${error.message}`);
    console.log('Continuando sem conexão com o banco de dados para fins de teste...');
    // Não encerra o processo para permitir testes sem MongoDB
    return null;
  }
};

module.exports = connectDB;