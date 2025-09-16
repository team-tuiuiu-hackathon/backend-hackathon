const axios = require('axios');
const { ethers } = require('ethers');

// Função para gerar mensagem de assinatura (deve ser igual à do backend)
function generateSignMessage(walletAddress, nonce) {
  return `Faça login na plataforma com sua carteira Web3.

Endereço da carteira: ${walletAddress}
Nonce: ${nonce}

Esta solicitação não custará nenhuma taxa de gás.`;
}

async function testCompleteWeb3Auth() {
  console.log('=== TESTE COMPLETO DE AUTENTICAÇÃO WEB3 ===\n');
  
  try {
    // Criar uma carteira de teste
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    
    console.log(`🔑 Carteira de teste criada: ${walletAddress}\n`);
    
    // Passo 1: Gerar nonce
    console.log('1️⃣ Gerando nonce...');
    const nonceResponse = await axios.post('http://localhost:3000/api/v1/auth/web3/nonce', {
      walletAddress: walletAddress
    });
    
    const nonce = nonceResponse.data.nonce;
    console.log(`✅ Nonce gerado: ${nonce}\n`);
    
    // Passo 2: Gerar mensagem e assinar
    console.log('2️⃣ Gerando mensagem e assinando...');
    const message = generateSignMessage(walletAddress, nonce);
    console.log(`📝 Mensagem a ser assinada:\n${message}\n`);
    
    const signature = await wallet.signMessage(message);
    console.log(`✍️ Assinatura gerada: ${signature}\n`);
    
    // Passo 3: Verificar assinatura
    console.log('3️⃣ Verificando assinatura...');
    const verifyResponse = await axios.post('http://localhost:3000/api/v1/auth/web3/verify', {
      walletAddress: walletAddress,
      signature: signature
    });
    
    console.log('✅ Autenticação bem-sucedida!');
    console.log(`🎫 Token JWT recebido: ${verifyResponse.data.token.substring(0, 50)}...`);
    console.log(`👤 Usuário: ${verifyResponse.data.data.user.walletAddress}\n`);
    
    // Passo 4: Testar endpoint protegido
    console.log('4️⃣ Testando endpoint protegido /me...');
    const meResponse = await axios.get('http://localhost:3000/api/v1/auth/me', {
      headers: {
        'Authorization': `Bearer ${verifyResponse.data.token}`
      }
    });
    
    console.log('✅ Acesso ao endpoint protegido bem-sucedido!');
    console.log(`👤 Dados do usuário: ${JSON.stringify(meResponse.data.data.user, null, 2)}\n`);
    
    console.log('🎉 TESTE COMPLETO FINALIZADO COM SUCESSO!');
    console.log('\n📋 RESUMO:');
    console.log('✅ Nonce gerado');
    console.log('✅ Mensagem assinada');
    console.log('✅ Assinatura verificada');
    console.log('✅ Token JWT obtido');
    console.log('✅ Endpoint protegido acessado');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.log('\n📊 Detalhes do erro:');
      console.log(`Status: ${error.response.status}`);
      console.log(`Mensagem: ${error.response.data.message}`);
      if (error.response.data.stack) {
        console.log(`Stack: ${error.response.data.stack}`);
      }
    }
  }
}

// Função para demonstrar como usar com MetaMask (exemplo conceitual)
function demonstrateMetaMaskUsage() {
  console.log('\n=== COMO USAR COM METAMASK (FRONTEND) ===\n');
  
  const frontendCode = `
// 1. Conectar com MetaMask
const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
const walletAddress = accounts[0];

// 2. Gerar nonce
const nonceResponse = await fetch('/api/v1/auth/web3/nonce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
});
const { nonce } = await nonceResponse.json();

// 3. Gerar mensagem
const message = \`Faça login na plataforma com sua carteira Web3.

Endereço da carteira: \${walletAddress}
Nonce: \${nonce}

Esta solicitação não custará nenhuma taxa de gás.\`;

// 4. Assinar mensagem
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [message, walletAddress]
});

// 5. Verificar assinatura
const verifyResponse = await fetch('/api/v1/auth/web3/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress, signature })
});
const { token } = await verifyResponse.json();

// 6. Usar token para acessar endpoints protegidos
localStorage.setItem('authToken', token);
  `;
  
  console.log('📝 Código JavaScript para frontend:');
  console.log(frontendCode);
}

// Executar teste
testCompleteWeb3Auth().then(() => {
  demonstrateMetaMaskUsage();
});