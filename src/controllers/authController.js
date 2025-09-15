const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
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
  const token = signToken(user._id);

  // Remove a senha da saída
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

/**
 * Registra um novo usuário
 */
exports.signup = async (req, res, next) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      role: req.body.role,
    });

    createSendToken(newUser, 201, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Faz login de um usuário
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Verificar se email e senha existem
    if (!email || !password) {
      return next(new AppError('Por favor, forneça email e senha!', 400));
    }

    // 2) Verificar se o usuário existe && senha está correta
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Email ou senha incorretos', 401));
    }

    // 3) Se tudo estiver ok, enviar token para o cliente
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualiza a senha do usuário atual
 */
exports.updatePassword = async (req, res, next) => {
  try {
    // 1) Obter o usuário da coleção
    const user = await User.findById(req.user.id).select('+password');

    // 2) Verificar se a senha atual está correta
    if (!await user.correctPassword(req.body.passwordCurrent, user.password)) {
      return next(new AppError('Sua senha atual está incorreta.', 401));
    }

    // 3) Se a senha estiver correta, atualize a senha
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // 4) Fazer login do usuário, enviar JWT
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};