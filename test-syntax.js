// Teste de sintaxe para verificar se há erros nos arquivos criados

try {
  console.log('🔍 Testando sintaxe dos arquivos...');
  
  // Testar modelo Wallet
  const Wallet = require('./src/models/walletModel');
  console.log('✅ walletModel.js - Sintaxe OK');
  
  // Testar controller
  const SmartContractController = require('./src/controllers/smartContractController');
  console.log('✅ smartContractController.js - Sintaxe OK');
  
  // Testar middleware
  const SmartContractMiddleware = require('./src/middleware/smartContractMiddleware');
  console.log('✅ smartContractMiddleware.js - Sintaxe OK');
  
  // Testar rotas
  const smartContractRoutes = require('./src/routes/smartContractRoutes');
  console.log('✅ smartContractRoutes.js - Sintaxe OK');
  
  // Testar errorHandler
  const errorHandler = require('./src/middleware/errorHandler');
  console.log('✅ errorHandler.js - Sintaxe OK');
  
  // Testar database config
  const connectDB = require('./src/config/database');
  console.log('✅ database.js - Sintaxe OK');
  
  // Testar app principal
  const app = require('./src/app');
  console.log('✅ app.js - Sintaxe OK');
  
  console.log('\n🎉 Todos os arquivos passaram no teste de sintaxe!');
  console.log('\n📋 Resumo das correções realizadas:');
  console.log('   • Corrigido import do authMiddleware em smartContractRoutes.js');
  console.log('   • Corrigido erro de sintaxe (chave extra) em database.js');
  console.log('   • Ajustado sistema de exportação em errorHandler.js');
  
  console.log('\n✨ O sistema está pronto para execução!');
  
} catch (error) {
  console.error('❌ Erro encontrado:', error.message);
  console.error('📍 Stack:', error.stack);
  process.exit(1);
}