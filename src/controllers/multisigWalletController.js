const MultisigWallet = require('../models/multisigWalletModel');
const User = require('../models/userModel');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class MultisigWalletController {
  
  // BE01 - Criar carteira multisig
  static async createWallet(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { name, description, threshold, participants, contractAddress } = req.body;
      const createdBy = req.user.id;

      // Verificar se o usuário criador está na lista de participantes
      const creatorInParticipants = participants.some(p => p.userId === createdBy);
      if (!creatorInParticipants) {
        participants.push({
          userId: createdBy,
          publicKey: req.user.publicKey,
          role: 'admin'
        });
      }

      // Validar threshold
      if (threshold > participants.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Threshold não pode ser maior que o número de participantes'
        });
      }

      // Verificar se todos os participantes existem
      const userIds = participants.map(p => p.userId);
      const existingUsers = await User.findAll({ 
        where: { 
          id: { [Op.in]: userIds } 
        } 
      });
      
      if (existingUsers.length !== userIds.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Um ou mais participantes não foram encontrados'
        });
      }

      // Verificar se o contrato já existe
      const existingWallet = await MultisigWallet.findOne({ 
        where: { contractAddress } 
      });
      if (existingWallet) {
        return res.status(409).json({
          status: 'error',
          message: 'Já existe uma carteira com este endereço de contrato'
        });
      }

      // Criar a carteira
      const walletData = {
        walletId: uuidv4(),
        name,
        description,
        contractAddress,
        threshold,
        participants: participants.map(p => ({
          ...p,
          addedBy: createdBy,
          addedAt: new Date()
        })),
        createdBy,
        balance: '0.00'
      };

      const wallet = await MultisigWallet.create(walletData);

      res.status(201).json({
        status: 'success',
        message: 'Carteira multisig criada com sucesso',
        data: {
          wallet: {
            id: wallet.id,
            walletId: wallet.walletId,
            name: wallet.name,
            description: wallet.description,
            contractAddress: wallet.contractAddress,
            threshold: wallet.threshold,
            participantCount: wallet.participants ? wallet.participants.length : 0,
            status: wallet.status,
            createdAt: wallet.createdAt
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE02 - Atualizar threshold
  static async updateThreshold(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { walletId } = req.params;
      const { threshold } = req.body;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é admin da carteira
      const participants = wallet.participants || [];
      const userParticipant = participants.find(p => p.userId === userId);
      if (!userParticipant || userParticipant.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem alterar o threshold'
        });
      }

      // Validar novo threshold
      if (threshold > participants.length || threshold < 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Threshold deve estar entre 1 e o número de participantes'
        });
      }

      const oldThreshold = wallet.threshold;
      await wallet.update({ threshold });

      res.json({
        status: 'success',
        message: 'Threshold atualizado com sucesso',
        data: {
          walletId: wallet.walletId,
          oldThreshold,
          newThreshold: threshold,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE03 - Adicionar participante
  static async addParticipant(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { walletId } = req.params;
      const { userId: newUserId, publicKey, role = 'participant' } = req.body;
      const adminUserId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é admin da carteira
      const participants = wallet.participants || [];
      const adminParticipant = participants.find(p => p.userId === adminUserId);
      if (!adminParticipant || adminParticipant.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem adicionar participantes'
        });
      }

      // Verificar se o novo usuário existe
      const newUser = await User.findById(newUserId);
      if (!newUser) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuário não encontrado'
        });
      }

      // Adicionar participante
      wallet.addParticipant(newUserId, publicKey, role, adminUserId);
      await wallet.save();

      res.json({
        status: 'success',
        message: 'Participante adicionado com sucesso',
        data: {
          walletId: wallet.walletId,
          newParticipant: {
            userId: newUserId,
            name: newUser.name,
            email: newUser.email,
            role,
            addedAt: new Date()
          },
          participantCount: wallet.participantCount
        }
      });

    } catch (error) {
      if (error.message.includes('já é participante')) {
        return res.status(409).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // BE03 - Remover participante
  static async removeParticipant(req, res, next) {
    try {
      const { walletId, userId: targetUserId } = req.params;
      const adminUserId = req.user.id;

      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é admin da carteira
      if (!wallet.isAdmin(adminUserId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem remover participantes'
        });
      }

      // Não permitir remover o criador da carteira
      if (wallet.createdBy.toString() === targetUserId) {
        return res.status(400).json({
          status: 'error',
          message: 'Não é possível remover o criador da carteira'
        });
      }

      // Remover participante
      wallet.removeParticipant(targetUserId);
      await wallet.save();

      res.json({
        status: 'success',
        message: 'Participante removido com sucesso',
        data: {
          walletId: wallet.walletId,
          removedUserId: targetUserId,
          participantCount: wallet.participantCount,
          currentThreshold: wallet.threshold
        }
      });

    } catch (error) {
      if (error.message.includes('não encontrado') || error.message.includes('threshold')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // BE04 - Listar membros da carteira
  static async getWalletMembers(req, res, next) {
    try {
      const { walletId } = req.params;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é participante da carteira
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado: você não é participante desta carteira'
        });
      }

      const members = wallet.participants.map(participant => ({
        userId: participant.userId._id,
        name: participant.userId.name,
        email: participant.userId.email,
        publicKey: participant.publicKey,
        role: participant.role,
        addedAt: participant.addedAt,
        addedBy: participant.addedBy
      }));

      res.json({
        status: 'success',
        data: {
          walletId: wallet.walletId,
          walletName: wallet.name,
          threshold: wallet.threshold,
          participantCount: wallet.participantCount,
          members
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Listar carteiras do usuário
  static async getUserWallets(req, res, next) {
    try {
      const userId = req.user.id;
      const { status = 'active', page = 1, limit = 10 } = req.query;

      const query = {
        'participants.userId': userId,
        status
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };

      const wallets = await MultisigWallet.find(query)
        .select('walletId name description threshold participantCount status balance createdAt')
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .sort(options.sort);

      const total = await MultisigWallet.countDocuments(query);

      res.json({
        status: 'success',
        data: {
          wallets,
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Obter detalhes de uma carteira
  static async getWalletDetails(req, res, next) {
    try {
      const { walletId } = req.params;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é participante da carteira
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado: você não é participante desta carteira'
        });
      }

      const userRole = wallet.participants.find(p => p.userId._id.toString() === userId).role;

      res.json({
        status: 'success',
        data: {
          wallet: {
            id: wallet._id,
            walletId: wallet.walletId,
            name: wallet.name,
            description: wallet.description,
            contractAddress: wallet.contractAddress,
            threshold: wallet.threshold,
            participantCount: wallet.participantCount,
            status: wallet.status,
            balance: wallet.balance,
            divisionRules: wallet.divisionRules,
            createdBy: wallet.createdBy,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt,
            userRole,
            isAdmin: wallet.isAdmin(userId)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Atualizar informações básicas da carteira
  static async updateWallet(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { walletId } = req.params;
      const { name, description } = req.body;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é admin da carteira
      if (!wallet.isAdmin(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem atualizar informações da carteira'
        });
      }

      if (name) wallet.name = name;
      if (description !== undefined) wallet.description = description;

      await wallet.save();

      res.json({
        status: 'success',
        message: 'Carteira atualizada com sucesso',
        data: {
          wallet: {
            id: wallet._id,
            walletId: wallet.walletId,
            name: wallet.name,
            description: wallet.description,
            updatedAt: wallet.updatedAt
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = MultisigWalletController;