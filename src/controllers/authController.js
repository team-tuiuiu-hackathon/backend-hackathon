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
  const token = signToken(user.id);

  // Remove a senha da saída
  const userResponse = { ...user.toJSON() };
  delete userResponse.password;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userResponse,
    },
  });
};

/**
 * Registra um novo usuário
 */
exports.signup = async (req, res, next) => {
  try {
    const { fullName, email, password, passwordConfirm } = req.body;

    // Validação básica dos campos obrigatórios
    if (!fullName || !email || !password) {
      return next(new AppError('Todos os campos são obrigatórios: nome completo, email e senha', 400));
    }

    // Validação de correspondência de senhas (apenas se passwordConfirm for fornecido)
    if (passwordConfirm && password !== passwordConfirm) {
      return next(new AppError('Senha e confirmação de senha devem ser iguais', 400));
    }

    // Criar novo usuário
    const newUser = await User.create({
      fullName,
      email,
      password,
      passwordConfirm
    });

    createSendToken(newUser, 201, res);
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
    const user = await User.findOne({ 
      where: { email },
      attributes: { include: ['password'] }
    });

    if (!user || !(await user.correctPassword(password))) {
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
    const { passwordCurrent, password, passwordConfirm } = req.body;

    // Validação básica dos campos
    if (!passwordCurrent || !password || !passwordConfirm) {
      return next(new AppError('Todos os campos são obrigatórios: senha atual, nova senha e confirmação', 400));
    }

    // Validação de correspondência de senhas
    if (password !== passwordConfirm) {
      return next(new AppError('Nova senha e confirmação devem ser iguais', 400));
    }

    // 1) Obter o usuário da base de dados
    const user = await User.findByPk(req.user.id, {
      attributes: { include: ['password'] }
    });

    // 2) Verificar se a senha atual está correta
    if (!await user.correctPassword(passwordCurrent)) {
      return next(new AppError('Sua senha atual está incorreta.', 401));
    }

    // 3) Se a senha estiver correta, atualize a senha
    user.password = password;
    user.passwordConfirm = passwordConfirm;
    await user.save();

    // 4) Fazer login do usuário, enviar JWT
    createSendToken(user, 200, res);
  } catch (error) {
    // Tratamento específico para erros de validação do Sequelize
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return next(new AppError(messages.join('. '), 400));
    }
    
    next(error);
  }
};