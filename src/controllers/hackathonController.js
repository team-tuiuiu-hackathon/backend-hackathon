const Hackathon = require('../models/hackathonModel');
const { AppError } = require('../middleware/errorHandler');
const { Op } = require('sequelize');

/**
 * Obtém todos os hackathons
 */
exports.getAllHackathons = async (req, res, next) => {
  try {
    // Construir a query
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Converter filtros para Sequelize
    const whereClause = {};
    
    Object.keys(queryObj).forEach(key => {
      const value = queryObj[key];
      
      if (typeof value === 'object') {
        // Operadores de comparação
        const operators = {};
        if (value.gte) operators[Op.gte] = value.gte;
        if (value.gt) operators[Op.gt] = value.gt;
        if (value.lte) operators[Op.lte] = value.lte;
        if (value.lt) operators[Op.lt] = value.lt;
        
        if (Object.keys(operators).length > 0) {
          whereClause[key] = operators;
        }
      } else {
        whereClause[key] = value;
      }
    });

    // Configurar ordenação
    let order = [['createdAt', 'DESC']];
    if (req.query.sort) {
      const sortFields = req.query.sort.split(',');
      order = sortFields.map(field => {
        if (field.startsWith('-')) {
          return [field.substring(1), 'DESC'];
        }
        return [field, 'ASC'];
      });
    }

    // Configurar campos selecionados
    let attributes = undefined;
    if (req.query.fields) {
      attributes = req.query.fields.split(',');
    }

    // Paginação
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const offset = (page - 1) * limit;

    // Executar a query
    const { count, rows: hackathons } = await Hackathon.findAndCountAll({
      where: whereClause,
      order,
      attributes,
      limit,
      offset
    });

    // Enviar resposta
    res.status(200).json({
      status: 'success',
      results: hackathons.length,
      totalCount: count,
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
    const hackathon = await Hackathon.findByPk(req.params.id);

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
    req.body.organizerId = req.user.id;

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
    const hackathon = await Hackathon.findByPk(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o usuário é o organizador ou um administrador
    if (
      hackathon.organizerId !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new AppError('Você não tem permissão para atualizar este hackathon', 403)
      );
    }

    await hackathon.update(req.body);

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
 * Deleta um hackathon pelo ID
 */
exports.deleteHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findByPk(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o usuário é o organizador ou um administrador
    if (
      hackathon.organizerId !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new AppError('Você não tem permissão para deletar este hackathon', 403)
      );
    }

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
    const hackathon = await Hackathon.findByPk(req.params.id);

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
    const participants = hackathon.participants || [];
    if (participants.includes(req.user.id)) {
      return next(
        new AppError('Você já está registrado neste hackathon', 400)
      );
    }

    // Verificar se o limite de participantes foi atingido
    if (
      hackathon.maxParticipants &&
      participants.length >= hackathon.maxParticipants
    ) {
      return next(
        new AppError('Este hackathon já atingiu o limite de participantes', 400)
      );
    }

    // Adicionar o usuário à lista de participantes
    participants.push(req.user.id);
    await hackathon.update({ participants });

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
    const hackathon = await Hackathon.findByPk(req.params.id);

    if (!hackathon) {
      return next(new AppError('Nenhum hackathon encontrado com esse ID', 404));
    }

    // Verificar se o usuário está registrado no hackathon
    const participants = hackathon.participants || [];
    if (!participants.includes(req.user.id)) {
      return next(
        new AppError('Você precisa estar registrado no hackathon para criar uma equipe', 400)
      );
    }

    // Verificar se o usuário já está em uma equipe
    const teams = hackathon.teams || [];
    const userInTeam = teams.some((team) =>
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

    teams.push(newTeam);
    await hackathon.update({ teams });

    res.status(201).json({
      status: 'success',
      message: 'Equipe criada com sucesso',
      data: {
        hackathon,
        team: newTeam,
      },
    });
  } catch (error) {
    next(error);
  }
};