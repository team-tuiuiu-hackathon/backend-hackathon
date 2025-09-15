const Hackathon = require('../models/hackathonModel');
const { AppError } = require('../middleware/errorHandler');

/**
 * Obtém todos os hackathons
 */
exports.getAllHackathons = async (req, res, next) => {
  try {
    // Construir a query
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Filtros avançados
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    let query = Hackathon.find(JSON.parse(queryStr));

    // Ordenação
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Limitação de campos
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    } else {
      query = query.select('-__v');
    }

    // Paginação
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Executar a query
    const hackathons = await query;

    // Enviar resposta
    res.status(200).json({
      status: 'success',
      results: hackathons.length,
      data: {
        hackathons,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtém um hackathon pelo ID
 */
exports.getHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        hackathon,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cria um novo hackathon
 */
exports.createHackathon = async (req, res, next) => {
  try {
    // Adiciona o usuário atual como organizador
    req.body.organizer = req.user.id;

    const newHackathon = await Hackathon.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        hackathon: newHackathon,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualiza um hackathon pelo ID
 */
exports.updateHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o usuário é o organizador ou um administrador
    if (
      hackathon.organizer.id !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new AppError('Você não tem permissão para atualizar este hackathon', 403)
      );
    }

    const updatedHackathon = await Hackathon.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        hackathon: updatedHackathon,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exclui um hackathon pelo ID
 */
exports.deleteHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o usuário é o organizador ou um administrador
    if (
      hackathon.organizer.id !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new AppError('Você não tem permissão para excluir este hackathon', 403)
      );
    }

    await Hackathon.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Registra um usuário em um hackathon
 */
exports.registerForHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o hackathon está com inscrições abertas
    if (hackathon.status !== 'inscrições abertas') {
      return next(
        new AppError('As inscrições para este hackathon não estão abertas', 400)
      );
    }

    // Verificar se o usuário já está registrado
    if (hackathon.participants.includes(req.user.id)) {
      return next(
        new AppError('Você já está registrado neste hackathon', 400)
      );
    }

    // Verificar se o limite de participantes foi atingido
    if (
      hackathon.maxParticipants &&
      hackathon.participants.length >= hackathon.maxParticipants
    ) {
      return next(
        new AppError('Este hackathon já atingiu o limite de participantes', 400)
      );
    }

    // Adicionar o usuário à lista de participantes
    hackathon.participants.push(req.user.id);
    await hackathon.save();

    res.status(200).json({
      status: 'success',
      message: 'Você foi registrado com sucesso neste hackathon',
      data: {
        hackathon,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cria uma equipe em um hackathon
 */
exports.createTeam = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o usuário está registrado no hackathon
    if (!hackathon.participants.includes(req.user.id)) {
      return next(
        new AppError('Você precisa estar registrado no hackathon para criar uma equipe', 400)
      );
    }

    // Verificar se o usuário já está em uma equipe
    const userInTeam = hackathon.teams.some((team) =>
      team.members.includes(req.user.id)
    );

    if (userInTeam) {
      return next(
        new AppError('Você já está em uma equipe neste hackathon', 400)
      );
    }

    // Criar a equipe
    const newTeam = {
      name: req.body.name,
      members: [req.user.id],
      project: {
        name: req.body.projectName || '',
        description: req.body.projectDescription || '',
        repositoryUrl: req.body.repositoryUrl || '',
      },
    };

    hackathon.teams.push(newTeam);
    await hackathon.save();

    res.status(201).json({
      status: 'success',
      message: 'Equipe criada com sucesso',
      data: {
        team: newTeam,
      },
    });
  } catch (error) {
    next(error);
  }
};