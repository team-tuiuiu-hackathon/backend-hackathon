const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const Web3User = require('../models/web3UserModel');
const { AppError } = require('./errorHandler');

/**
 * Middleware para proteger rotas que requerem autenticação Web3
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Verificar se o token existe
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('Você não está logado! Por favor, faça login Web3 para ter acesso.', 401)
      );
    }

    // 2) Verificar se o token é válido
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Verificar se o usuário Web3 ainda existe
    const currentUser = await Web3User.findByPk(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('O usuário Web3 pertencente a este token não existe mais.', 401)
      );
    }

    // 4) Verificar se o usuário está ativo
    if (!currentUser.isActive) {
      return next(
        new AppError('Sua conta Web3 foi desativada. Entre em contato com o suporte.', 401)
      );
    }

    // Conceder acesso à rota protegida
    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Falha na autenticação Web3. Por favor, faça login novamente.', 401));
  }
};

/**
 * Middleware para restringir acesso baseado em roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Você não tem permissão para executar esta ação.', 403)
      );
    }
    next();
  };
};