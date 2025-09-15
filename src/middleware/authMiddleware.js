const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/userModel');
const { AppError } = require('./errorHandler');

/**
 * Middleware para proteger rotas que requerem autenticação
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
        new AppError('Você não está logado! Por favor, faça login para ter acesso.', 401)
      );
    }

    // 2) Verificar se o token é válido
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Verificar se o usuário ainda existe
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('O usuário pertencente a este token não existe mais.', 401)
      );
    }

    // 4) Verificar se o usuário alterou a senha após o token ser emitido
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('Usuário alterou a senha recentemente! Por favor, faça login novamente.', 401)
      );
    }

    // Conceder acesso à rota protegida
    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Falha na autenticação. Por favor, faça login novamente.', 401));
  }
};

/**
 * Middleware para restringir acesso baseado em funções
 * @param  {...String} roles - Funções permitidas
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Você não tem permissão para realizar esta ação', 403)
      );
    }

    next();
  };
};