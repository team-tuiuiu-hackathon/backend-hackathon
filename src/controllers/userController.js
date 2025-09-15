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
 * Obtém todos os usuários
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find();

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
 * Obtém um usuário pelo ID
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError('Nenhum usuário encontrado com esse ID', 404));
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
 * Atualiza o usuário atual
 */
exports.updateMe = async (req, res, next) => {
  try {
    // 1) Criar erro se o usuário tentar atualizar a senha
    if (req.body.password || req.body.passwordConfirm) {
      return next(
        new AppError(
          'Esta rota não é para atualizações de senha. Por favor, use /updateMyPassword.',
          400
        )
      );
    }

    // 2) Filtrar campos que não são permitidos
    const filteredBody = filterObj(req.body, 'name', 'email', 'photo');

    // 3) Atualizar documento do usuário
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Desativa o usuário atual (não exclui da base de dados)
 */
exports.deleteMe = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { active: false });

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
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return next(new AppError('Nenhum usuário encontrado com esse ID', 404));
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
 * Exclui um usuário pelo ID (apenas para administradores)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return next(new AppError('Nenhum usuário encontrado com esse ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};