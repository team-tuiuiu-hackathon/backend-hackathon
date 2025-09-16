const StellarSdk = require('stellar-sdk');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const StellarUser = require('../models/stellarUserModel');

// Configurar para usar a rede de teste Stellar
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
StellarSdk.Networks.TESTNET;

/**
 * Gera um challenge seguro de 64 caracteres
 */
const generateChallenge = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Cria um token JWT para o usuário autenticado
 */
const createSendToken = (user, statusCode, res) => {
  const token = jwt.sign(
    { 
      id: user.id, 
      address: user.address 
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );

  // Remove campos sensíveis da resposta
  const userResponse = {
    id: user.id,
    address: user.address,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt
  };

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userResponse
    }
  });
};

/**
 * POST /api/stellar/challenge
 * Gera um challenge para autenticação Stellar
 */
const generateStellarChallenge = async (req, res) => {
  try {
    const { publicKey } = req.body;

    // Validação da chave pública
    if (!publicKey) {
      return res.status(400).json({
        status: 'error',
        message: 'publicKey é obrigatória'
      });
    }

    // Validar formato da chave pública Stellar
    try {
      StellarSdk.Keypair.fromPublicKey(publicKey);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'publicKey inválida'
      });
    }

    // Gerar challenge seguro
    const challenge = generateChallenge();

    // Salvar/atualizar usuário no banco de dados
    await StellarUser.createOrUpdateWithChallenge(publicKey, challenge);

    // Criar transação Stellar para o challenge
    const account = await server.loadAccount(publicKey).catch(() => {
      // Se a conta não existir na rede, criar uma transação básica
      return new StellarSdk.Account(publicKey, '0');
    });

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: 'auth_challenge',
          value: challenge
        })
      )
      .setTimeout(300) // 5 minutos para assinar
      .build();

    // Retornar XDR da transação não assinada
    res.status(200).json({
      status: 'success',
      data: {
        transactionXDR: transaction.toXDR(),
        challenge: challenge,
        expiresIn: 300 // 5 minutos em segundos
      }
    });

  } catch (error) {
    console.error('Erro ao gerar challenge Stellar:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * POST /api/stellar/login
 * Verifica a assinatura e autentica o usuário
 */
const stellarLogin = async (req, res) => {
  try {
    const { signedXDR } = req.body;

    // Validação do XDR assinado
    if (!signedXDR) {
      return res.status(400).json({
        status: 'error',
        message: 'signedXDR é obrigatório'
      });
    }

    // Desserializar a transação
    let transaction;
    try {
      transaction = StellarSdk.TransactionBuilder.fromXDR(signedXDR, StellarSdk.Networks.TESTNET);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'XDR inválido'
      });
    }

    // Extrair a chave pública da conta source
    const publicKey = transaction.source;

    // Buscar usuário no banco de dados
    const user = await StellarUser.findByAddress(publicKey);
    if (!user || !user.challenge) {
      return res.status(401).json({
        status: 'error',
        message: 'Challenge não encontrado ou expirado'
      });
    }

    // Verificar se a operação ManageData contém o challenge correto
    const operations = transaction.operations;
    const manageDataOp = operations.find(op => 
      op.type === 'manageData' && 
      op.name === 'auth_challenge'
    );

    if (!manageDataOp || manageDataOp.value !== user.challenge) {
      return res.status(401).json({
        status: 'error',
        message: 'Challenge inválido'
      });
    }

    // Verificar a assinatura da transação
    const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
    
    // Verificar se a transação foi assinada corretamente
    const transactionHash = transaction.hash();
    const signatures = transaction.signatures;
    
    if (signatures.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Transação não assinada'
      });
    }

    // Verificar se pelo menos uma assinatura é válida
    let validSignature = false;
    for (const signature of signatures) {
      try {
        if (keypair.verify(transactionHash, signature.signature())) {
          validSignature = true;
          break;
        }
      } catch (error) {
        // Continuar verificando outras assinaturas
        continue;
      }
    }

    if (!validSignature) {
      return res.status(401).json({
        status: 'error',
        message: 'Assinatura inválida'
      });
    }

    // Autenticação bem-sucedida
    // Limpar o challenge para evitar reuso
    await user.clearChallenge();
    await user.updateLastLogin();

    // Criar e enviar token JWT
    createSendToken(user, 200, res);

  } catch (error) {
    console.error('Erro no login Stellar:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para verificar token JWT Stellar
 */
const protectStellar = async (req, res, next) => {
  try {
    // 1) Verificar se o token existe
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Você não está logado! Por favor, faça login para ter acesso.'
      });
    }

    // 2) Verificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Verificar se o usuário ainda existe
    const currentUser = await StellarUser.findByPk(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'O usuário pertencente a este token não existe mais.'
      });
    }

    // 4) Verificar se o usuário está ativo
    if (!currentUser.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Sua conta foi desativada. Entre em contato com o suporte.'
      });
    }

    // Conceder acesso à rota protegida
    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido. Por favor, faça login novamente!'
    });
  }
};

/**
 * GET /api/stellar/me
 * Retorna informações do usuário autenticado
 */
const getStellarMe = async (req, res) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          address: user.address,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  generateStellarChallenge,
  stellarLogin,
  protectStellar,
  getStellarMe
};