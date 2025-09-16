const axios = require('axios');
const { ethers } = require('ethers');

function generateSignMessage(walletAddress, nonce) {
  return `Faça login na plataforma com sua carteira Web3.

Endereço da carteira: ${walletAddress}
Nonce: ${nonce}

Esta solicitação não custará nenhuma taxa de gás.`;
}

async function debugTest() {
  try {
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    
    console.log('Wallet:', walletAddress);
    
    // Gerar nonce
    const nonceResponse = await axios.post('http://localhost:3000/api/v1/auth/web3/nonce', {
      walletAddress: walletAddress
    });
    
    const nonce = nonceResponse.data.data.nonce;
    console.log('Nonce:', nonce);
    
    // Gerar mensagem
    const message = generateSignMessage(walletAddress, nonce);
    console.log('Mensagem gerada:');
    console.log('---START---');
    console.log(message);
    console.log('---END---');
    console.log('Tamanho da mensagem:', message.length);
    console.log('Bytes da mensagem:', Buffer.from(message, 'utf8').toString('hex'));
    
    // Assinar
    const signature = await wallet.signMessage(message);
    console.log('Assinatura:', signature);
    console.log('Tamanho da assinatura:', signature.length);
    
    // Verificar localmente
    const recoveredAddress = ethers.verifyMessage(message, signature);
    console.log('Endereço recuperado localmente:', recoveredAddress);
    console.log('Endereços coincidem:', recoveredAddress.toLowerCase() === walletAddress.toLowerCase());
    
    // Testar no backend
    const verifyResponse = await axios.post('http://localhost:3000/api/v1/auth/web3/verify', {
      walletAddress: walletAddress,
      signature: signature
    });
    
    console.log('✅ Sucesso no backend!');
    console.log('Token:', verifyResponse.data.token.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

debugTest();