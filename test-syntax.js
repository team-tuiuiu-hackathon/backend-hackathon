// Syntax test to check for errors in created files

try {
  console.log('🔍 Testing file syntax...');
  
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
  
  console.log('\n🎉 All files passed the syntax test!');
  console.log('\n📋 Summary of fixes applied:');
  console.log('   • Fixed authMiddleware import in smartContractRoutes.js');
  console.log('   • Fixed syntax error (extra brace) in database.js');
  console.log('   • Adjusted export system in errorHandler.js');
  
  console.log('\n✨ The system is ready for execution!');
  
} catch (error) {
  console.error('❌ Error found:', error.message);
  console.error('📍 Stack:', error.stack);
  process.exit(1);
}