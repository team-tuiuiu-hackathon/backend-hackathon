/**
 * EXEMPLO DE USO - Sign-In with Stellar
 * 
 * Este arquivo demonstra como usar o sistema de autenticação Stellar
 * implementado no backend.
 */

const StellarSdk = require('stellar-sdk');
const axios = require('axios');

// Configuração
const API_BASE_URL = 'http://localhost:3000/api/v1';
const STELLAR_NETWORK = StellarSdk.Networks.TESTNET;

/**
 * Exemplo completo de autenticação Stellar
 */
async function exemploAutenticacaoStellar() {
  try {
    // 1. Gerar um par de chaves para teste (em produção, o usuário já teria)
    const keypair = StellarSdk.Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();
    
    console.log('🔑 Chaves geradas:');
    console.log('Public Key:', publicKey);
    console.log('Secret Key:', secretKey);
    console.log('');

    // 2. PASSO 1: Solicitar challenge
    console.log('📝 Solicitando challenge...');
    const challengeResponse = await axios.post(`${API_BASE_URL}/stellar/challenge`, {
      publicKey: publicKey
    });

    const { transactionXDR, challenge } = challengeResponse.data.data;
    console.log('✅ Challenge recebido:', challenge);
    console.log('📄 Transaction XDR:', transactionXDR.substring(0, 50) + '...');
    console.log('');

    // 3. PASSO 2: Assinar a transação
    console.log('✍️ Assinando transação...');
    const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, STELLAR_NETWORK);
    
    // Assinar com a chave privada
    transaction.sign(keypair);
    const signedXDR = transaction.toXDR();
    
    console.log('✅ Transação assinada');
    console.log('📄 Signed XDR:', signedXDR.substring(0, 50) + '...');
    console.log('');

    // 4. PASSO 3: Fazer login
    console.log('🔐 Fazendo login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/stellar/login`, {
      signedXDR: signedXDR
    });

    const { token, data } = loginResponse.data;
    console.log('✅ Login realizado com sucesso!');
    console.log('🎫 Token JWT:', token.substring(0, 50) + '...');
    console.log('👤 Dados do usuário:', data.user);
    console.log('');

    // 5. PASSO 4: Usar o token para acessar rota protegida
    console.log('🔒 Testando rota protegida...');
    const meResponse = await axios.get(`${API_BASE_URL}/stellar/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Dados do usuário autenticado:', meResponse.data.data.user);
    console.log('');
    console.log('🎉 Autenticação Stellar concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro na autenticação:', error.response?.data || error.message);
  }
}

/**
 * Exemplo de uso com chave existente
 */
async function exemploComChaveExistente(publicKey, secretKey) {
  try {
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    
    // Solicitar challenge
    const challengeResponse = await axios.post(`${API_BASE_URL}/stellar/challenge`, {
      publicKey: publicKey
    });

    const { transactionXDR } = challengeResponse.data.data;
    
    // Assinar transação
    const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, STELLAR_NETWORK);
    transaction.sign(keypair);
    
    // Fazer login
    const loginResponse = await axios.post(`${API_BASE_URL}/stellar/login`, {
      signedXDR: transaction.toXDR()
    });

    return loginResponse.data.token;
  } catch (error) {
    throw new Error(`Erro na autenticação: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Exemplo de middleware para verificar autenticação
 */
function criarMiddlewareAuth(token) {
  return {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
}

// Executar exemplo se este arquivo for executado diretamente
if (require.main === module) {
  console.log('🚀 Iniciando exemplo de autenticação Stellar...\n');
  exemploAutenticacaoStellar();
}

module.exports = {
  exemploAutenticacaoStellar,
  exemploComChaveExistente,
  criarMiddlewareAuth
};