const User = require('../models/userModel');
const { AppError } = require('../middleware/errorHandler');

/**
 * Filtra os campos permitidos para atualização
 */
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

/**
 * Get all users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return next(new AppError('Usuário não encontrado com esse ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualiza os dados do usuário atual
 */
exports.updateMe = async (req, res, next) => {
  try {
    // 1) Create error if user tries to update password
    if (req.body.password || req.body.passwordConfirm) {
      return next(
        new AppError(
          'Esta rota não é para atualização de senha. Use /updateMyPassword.',
          400
        )
      );
    }

    // 2) Filter fields that are allowed for update
    const filteredBody = filterObj(req.body, 'fullName', 'email');

    // 3) Update user document
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    await user.update(filteredBody);

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
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
 * Desativa o usuário atual (não exclui da base de dados)
 */
exports.deleteMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    // Como removemos o campo accountStatus, vamos apenas retornar sucesso
    // Em uma implementação futura, poderia ser adicionado um campo 'active'
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cria um novo usuário (apenas para administradores)
 */
exports.createUser = async (req, res, next) => {
  try {
    return next(
      new AppError('Esta rota não está definida! Por favor, use /signup', 400)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Atualiza um usuário pelo ID (apenas para administradores)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return next(new AppError('Nenhum usuário encontrado com esse ID', 404));
    }

    await user.update(req.body);

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
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
 * Exclui um usuário pelo ID (apenas para administradores)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return next(new AppError('Nenhum usuário encontrado com esse ID', 404));
    }

    await user.destroy();

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};