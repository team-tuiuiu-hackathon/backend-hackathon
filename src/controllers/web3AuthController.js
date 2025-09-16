const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const Web3User = require('../models/web3UserModel');
const { AppError } = require('../middleware/errorHandler');

/**
 * Cria e envia um token JWT
 */
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

/**
 * Cria e envia um token JWT para o cliente
 */
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);

  // Remove dados sensíveis da saída
  const userResponse = { ...user.toJSON() };
  delete userResponse.nonce;
  delete userResponse.nonceExpiry;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userResponse,
    },
  });
};

/**
 * Valida se um endereço Ethereum é válido
 */
const isValidEthereumAddress = (address) => {
  try {
    // Verifica se o endereço não está vazio e tem o formato correto
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    // Remove espaços em branco e converte para lowercase para evitar problemas de checksum
    address = address.trim().toLowerCase();
    
    // Verifica se começa com 0x e tem 42 caracteres
    if (!address.startsWith('0x') || address.length !== 42) {
      return false;
    }
    
    // Verifica se contém apenas caracteres hexadecimais válidos
    const hexPattern = /^0x[a-fA-F0-9]{40}$/i;
    if (!hexPattern.test(address)) {
      return false;
    }
    
    // Usa ethers.isAddress para validação (mais flexível que getAddress)
    return ethers.isAddress(address);
  } catch (error) {
    console.error('Erro na validação do endereço:', error.message);
    return false;
  }
};

/**
 * Gera uma mensagem padrão para assinatura
 */
const generateSignMessage = (walletAddress, nonce) => {
  return `Faça login na plataforma com sua carteira Web3.

Endereço da carteira: ${walletAddress}
Nonce: ${nonce}

Esta solicitação não custará nenhuma taxa de gás.`;
};

/**
 * Endpoint para gerar nonce único para autenticação Web3
 * POST /api/auth/web3/nonce
 */
exports.generateNonce = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    // Validação do endereço da carteira
  if (!walletAddress) {
    return next(new AppError('Endereço da carteira é obrigatório', 400));
  }

  if (!isValidEthereumAddress(walletAddress)) {
    return next(new AppError('Endereço da carteira inválido', 400));
  }

    // Criar ou encontrar usuário Web3
    const user = await Web3User.createOrUpdate(walletAddress);

    // Gerar novo nonce
    const nonce = user.generateNonce();
    
    // Salvar apenas se não for mock
    if (user.save && typeof user.save === 'function') {
      await user.save();
    }

    // Gerar mensagem para assinatura
    const message = generateSignMessage(walletAddress, nonce);

    res.status(200).json({
      status: 'success',
      data: {
        nonce,
        message,
        walletAddress: user.walletAddress,
        expiresAt: user.nonceExpiry
      }
    });

  } catch (error) {
    // Tratamento específico para erros de validação do Sequelize
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return next(new AppError(messages.join('. '), 400));
    }
    
    // Tratamento para erro de endereço duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(new AppError('Este endereço de carteira já está cadastrado', 400));
    }

    next(error);
  }
};

/**
 * Endpoint para verificar assinatura e autenticar usuário Web3
 * POST /api/auth/web3/verify
 */
exports.verifySignature = async (req, res, next) => {
  try {
    const { walletAddress, signature } = req.body;

    // Validação dos campos obrigatórios
    if (!walletAddress || !signature) {
      return next(new AppError('Endereço da carteira e assinatura são obrigatórios', 400));
    }

    if (!isValidEthereumAddress(walletAddress)) {
      return next(new AppError('Endereço da carteira inválido', 400));
    }

    // Validação básica do formato da assinatura
    if (!signature.startsWith('0x') || signature.length !== 132) {
      return next(new AppError('Formato de assinatura inválido. A assinatura deve ter 132 caracteres e começar com 0x', 400));
    }

    // Buscar usuário pelo endereço da carteira
    const user = await Web3User.findOne({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      return next(new AppError('Usuário não encontrado. Gere um nonce primeiro.', 404));
    }

    // Verificar se o nonce é válido
    if (!user.isNonceValid()) {
      return next(new AppError('Nonce inválido ou expirado. Gere um novo nonce.', 401));
    }

    // Usar o nonce armazenado no banco de dados
    const nonce = user.nonce;

    // Gerar mensagem original que foi assinada
    const originalMessage = generateSignMessage(walletAddress, nonce);

    try {
      // Verificar a assinatura
      const recoveredAddress = ethers.verifyMessage(originalMessage, signature);
      
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return next(new AppError('Assinatura inválida', 401));
      }

    } catch (signatureError) {
      return next(new AppError('Erro ao verificar assinatura: ' + signatureError.message, 401));
    }

    // Assinatura válida - limpar nonce e atualizar último login
    user.clearNonce();
    user.updateLastLogin();
    await user.save();

    // Gerar e enviar token JWT
    createSendToken(user, 200, res);

  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint para obter informações do usuário autenticado
 * GET /api/auth/web3/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await Web3User.findByPk(req.user.id);

    if (!user) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    // Remove dados sensíveis
    const userResponse = { ...user.toJSON() };
    delete userResponse.nonce;
    delete userResponse.nonceExpiry;

    res.status(200).json({
      status: 'success',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint para atualizar perfil do usuário Web3
 * PATCH /api/auth/web3/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, email } = req.body;
    const userId = req.user.id;

    // Buscar usuário
    const user = await Web3User.findByPk(userId);

    if (!user) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    // Atualizar apenas campos permitidos
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return next(new AppError('Nenhum campo válido fornecido para atualização', 400));
    }

    await user.update(updateData);

    // Remove dados sensíveis
    const userResponse = { ...user.toJSON() };
    delete userResponse.nonce;
    delete userResponse.nonceExpiry;

    res.status(200).json({
      status: 'success',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    // Tratamento específico para erros de validação do Sequelize
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return next(new AppError(messages.join('. '), 400));
    }
    
    // Tratamento para erro de email duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(new AppError('Este email já está cadastrado', 400));
    }

    next(error);
  }
};

/**
 * Middleware para proteger rotas Web3 (verificar JWT)
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Obter token do header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Você não está logado! Faça login para ter acesso.', 401));
    }

    // 2) Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Verificar se o usuário ainda existe
    const currentUser = await Web3User.findByPk(decoded.id);
    if (!currentUser) {
      return next(new AppError('O usuário deste token não existe mais.', 401));
    }

    // 4) Verificar se o usuário está ativo
    if (!currentUser.isActive) {
      return next(new AppError('Sua conta foi desativada. Entre em contato com o suporte.', 401));
    }

    // Conceder acesso à rota protegida
    req.user = currentUser;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token inválido. Faça login novamente!', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Seu token expirou! Faça login novamente.', 401));
    }
    
    next(error);
  }
};