const MultisigWallet = require('../models/multisigWalletModel');
const User = require('../models/userModel');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const AuditService = require('../services/auditService');

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

  // Integrar auditoria nos métodos existentes
  static async createUserWallet(req, res) {
    const auditService = new AuditService();
    
    try {
      const { name, description, requiredSignatures, participants, settings } = req.body;
      const userId = req.user.id;
      const userEmail = req.user.email;

      // Validações
      if (!name || !requiredSignatures) {
        await auditService.logFailedAction({
          action: 'create_wallet',
          resourceType: 'wallet',
          resourceId: null,
          error: new Error('Dados obrigatórios não fornecidos'),
          metadata: { name, requiredSignatures }
        }, { req, user: req.user });

        return res.status(400).json({
          success: false,
          message: 'Nome e número de assinaturas obrigatórias são obrigatórios'
        });
      }

      // Criar carteira
      const walletData = {
        name,
        description: description || '',
        createdBy: userId,
        requiredSignatures: parseInt(requiredSignatures),
        participants: [
          {
            userId,
            email: userEmail,
            role: 'super_admin',
            permissions: ['all'],
            joinedAt: new Date(),
            status: 'active'
          }
        ],
        settings: {
          allowParticipantInvites: settings?.allowParticipantInvites !== false,
          requireApprovalForNewParticipants: settings?.requireApprovalForNewParticipants !== false,
          maxParticipants: settings?.maxParticipants || 10,
          transactionLimits: {
            daily: settings?.dailyLimit || 1000000,
            perTransaction: settings?.perTransactionLimit || 100000
          },
          ...settings
        },
        status: 'active'
      };

      const wallet = await MultisigWallet.create(walletData);

      // Log de auditoria
      await auditService.logWalletAction({
        action: 'create_wallet',
        walletId: wallet.id,
        metadata: {
          walletName: name,
          requiredSignatures,
          participantCount: 1
        },
        severity: 'medium'
      }, { req, user: req.user });

      // Adicionar participantes se fornecidos
      if (participants && participants.length > 0) {
        for (const participant of participants) {
          if (participant.email !== userEmail) {
            await this.inviteParticipants(req, res, wallet.id, [participant]);
          }
        }
      }

      // Notificar criação
      await NotificationService.sendWalletCreatedNotification(userId, wallet);

      res.status(201).json({
        success: true,
        message: 'Carteira compartilhada criada com sucesso',
        data: {
          wallet: {
            id: wallet.id,
            name: wallet.name,
            description: wallet.description,
            requiredSignatures: wallet.requiredSignatures,
            participantCount: wallet.participants.length,
            status: wallet.status,
            createdAt: wallet.createdAt
          }
        }
      });

    } catch (error) {
      await auditService.logFailedAction({
        action: 'create_wallet',
        resourceType: 'wallet',
        resourceId: null,
        error,
        metadata: req.body
      }, { req, user: req.user });

      console.error('Erro ao criar carteira:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  static async addParticipant(req, res) {
    const auditService = new AuditService();
    
    try {
      const { walletId } = req.params;
      const { participantId, role = 'member', permissions = [] } = req.body;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      // Verificar permissões
      if (!wallet.hasPermission(userId, 'manage_participants')) {
        await auditService.logFailedAction({
          action: 'add_participant',
          resourceType: 'wallet',
          resourceId: walletId,
          error: new Error('Permissão negada'),
          metadata: { participantId, role }
        }, { req, user: req.user });

        return res.status(403).json({
          success: false,
          message: 'Sem permissão para adicionar participantes'
        });
      }

      // Buscar dados do participante
      const participant = await User.findByPk(participantId);
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      const oldParticipants = [...wallet.participants];
      
      // Adicionar participante
      await wallet.addParticipant(participantId, role, permissions);

      // Log de auditoria
      await auditService.logParticipantAction({
        action: 'add_participant',
        targetUserId: participantId,
        targetUserEmail: participant.email,
        walletId,
        oldValues: { participants: oldParticipants },
        newValues: { participants: wallet.participants },
        metadata: {
          participantEmail: participant.email,
          role,
          permissions
        },
        severity: 'medium'
      }, { req, user: req.user });

      // Notificar participante
      await NotificationService.sendParticipantAddedNotification(participantId, wallet, req.user);

      res.json({
        success: true,
        message: 'Participante adicionado com sucesso',
        data: {
          participant: {
            userId: participantId,
            email: participant.email,
            role,
            permissions,
            joinedAt: new Date()
          }
        }
      });

    } catch (error) {
      await auditService.logFailedAction({
        action: 'add_participant',
        resourceType: 'wallet',
        resourceId: req.params.walletId,
        error,
        metadata: req.body
      }, { req, user: req.user });

      console.error('Erro ao adicionar participante:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  static async updateWalletSettings(req, res) {
    const auditService = new AuditService();
    
    try {
      const { walletId } = req.params;
      const updates = req.body;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      // Verificar permissões
      if (!wallet.hasPermission(userId, 'manage_settings')) {
        await auditService.logFailedAction({
          action: 'update_settings',
          resourceType: 'wallet',
          resourceId: walletId,
          error: new Error('Permissão negada'),
          metadata: updates
        }, { req, user: req.user });

        return res.status(403).json({
          success: false,
          message: 'Sem permissão para alterar configurações'
        });
      }

      const oldSettings = { ...wallet.settings };
      
      // Atualizar configurações
      await wallet.updateAdminSettings(updates);

      // Log de auditoria
      await auditService.logWalletAction({
        action: 'update_settings',
        walletId,
        oldValues: { settings: oldSettings },
        newValues: { settings: wallet.settings },
        metadata: {
          updatedFields: Object.keys(updates),
          walletName: wallet.name
        },
        severity: 'medium'
      }, { req, user: req.user });

      res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso',
        data: {
          settings: wallet.settings
        }
      });

    } catch (error) {
      await auditService.logFailedAction({
        action: 'update_settings',
        resourceType: 'wallet',
        resourceId: req.params.walletId,
        error,
        metadata: req.body
      }, { req, user: req.user });

      console.error('Erro ao atualizar configurações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Novo método para obter logs de auditoria da carteira
  static async getWalletAuditLogs(req, res) {
    const auditService = new AuditService();
    
    try {
      const { walletId } = req.params;
      const { 
        startDate, 
        endDate, 
        eventType, 
        severity, 
        page = 1, 
        limit = 50 
      } = req.query;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      // Verificar permissões
      if (!wallet.hasPermission(userId, 'view_audit_logs')) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para visualizar logs de auditoria'
        });
      }

      const filters = {
        walletId,
        eventType,
        severity,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const logs = await auditService.searchLogs(filters);

      res.json({
        success: true,
        data: {
          logs: logs.data || logs,
          pagination: logs.pagination || {
            page: parseInt(page),
            limit: parseInt(limit),
            total: logs.length
          }
        }
      });

    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Novo método para gerar relatório de auditoria
  static async generateAuditReport(req, res) {
    const auditService = new AuditService();
    
    try {
      const { walletId } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      // Verificar permissões
      if (!wallet.hasPermission(userId, 'generate_reports')) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para gerar relatórios'
        });
      }

      const report = await auditService.generateWalletAuditReport(
        walletId,
        startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate ? new Date(endDate) : new Date()
      );

      // Log da geração do relatório
      await auditService.logWalletAction({
        action: 'generate_report',
        walletId,
        metadata: {
          reportType: 'audit',
          format,
          period: { startDate, endDate }
        },
        severity: 'low'
      }, { req, user: req.user });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-report-${walletId}.csv"`);
        return res.send(auditService.convertToCSV(report));
      }

      res.json({
        success: true,
        data: { report }
      });

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  static async inviteParticipants(req, res, next) {
    try {
      const { walletId } = req.params;
      const { participants, message } = req.body;
      const invitedBy = req.user.id;

      if (!participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Lista de participantes é obrigatória'
        });
      }

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar permissões
      if (!wallet.hasPermission(invitedBy, 'invite_participants')) {
        return res.status(403).json({
          status: 'error',
          message: 'Sem permissão para convidar participantes'
        });
      }

      // Verificar limite de participantes
      const currentParticipants = wallet.participants || [];
      const maxParticipants = wallet.adminSettings?.maxParticipants || 10;
      
      if (currentParticipants.length + participants.length > maxParticipants) {
        return res.status(400).json({
          status: 'error',
          message: `Limite máximo de ${maxParticipants} participantes seria excedido`
        });
      }

      // Processar convites
      const inviteResults = [];
      for (const participant of participants) {
        try {
          // Verificar se já é participante
          const isAlreadyParticipant = currentParticipants.some(p => p.userId === participant.userId);
          if (isAlreadyParticipant) {
            inviteResults.push({
              userId: participant.userId,
              status: 'already_participant',
              message: 'Usuário já é participante da carteira'
            });
            continue;
          }

          // Adicionar participante
          await wallet.addParticipant(
            participant.userId,
            participant.role || 'member',
            participant.permissions || ['view', 'propose', 'sign'],
            invitedBy
          );

          inviteResults.push({
            userId: participant.userId,
            status: 'invited',
            message: 'Convite enviado com sucesso'
          });

          // Enviar notificação de convite
          try {
            await NotificationService.notifyParticipantInvited(
              walletId,
              {
                walletName: wallet.name,
                invitedBy: req.user.name || req.user.email,
                role: participant.role || 'member',
                message: message || 'Você foi convidado para participar desta carteira compartilhada'
              },
              participant.userId
            );
          } catch (notificationError) {
            console.error('Erro ao enviar notificação de convite:', notificationError);
          }

        } catch (error) {
          inviteResults.push({
            userId: participant.userId,
            status: 'error',
            message: error.message
          });
        }
      }

      res.json({
        status: 'success',
        message: 'Convites processados',
        data: {
          inviteResults,
          walletId: wallet.walletId,
          totalParticipants: wallet.participants.length
        }
      });

    } catch (error) {
      next(error);
    }
  }

  static async acceptWalletInvite(req, res, next) {
    try {
      const { walletId } = req.params;
      const { acceptTerms = false } = req.body;
      const userId = req.user.id;

      if (!acceptTerms) {
        return res.status(400).json({
          status: 'error',
          message: 'É necessário aceitar os termos para participar da carteira'
        });
      }

      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário foi convidado
      const participants = wallet.participants || [];
      const participantIndex = participants.findIndex(p => p.userId === userId);
      
      if (participantIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Convite não encontrado'
        });
      }

      const participant = participants[participantIndex];
      if (participant.status === 'active') {
        return res.status(400).json({
          status: 'error',
          message: 'Convite já foi aceito anteriormente'
        });
      }

      // Aceitar convite
      participants[participantIndex] = {
        ...participant,
        status: 'active',
        acceptedAt: new Date(),
        acceptedTerms: true
      };

      wallet.participants = participants;
      await wallet.save();

      // Notificar outros participantes
      try {
        const otherParticipants = participants
          .filter(p => p.userId !== userId && p.status === 'active')
          .map(p => p.userId);

        await NotificationService.notifyParticipantJoined(
          walletId,
          {
            walletName: wallet.name,
            newParticipant: req.user.name || req.user.email,
            totalParticipants: participants.filter(p => p.status === 'active').length
          },
          otherParticipants
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: 'Convite aceito com sucesso',
        data: {
          wallet: {
            id: wallet.id,
            walletId: wallet.walletId,
            name: wallet.name,
            description: wallet.description,
            role: participant.role,
            permissions: participant.permissions,
            joinedAt: participant.acceptedAt
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  static async getUserWallets(req, res, next) {
    try {
      const userId = req.user.id;
      const { status = 'active', role, page = 1, limit = 20 } = req.query;

      // Buscar carteiras onde o usuário é participante
      const whereClause = {
        participants: {
          [Op.contains]: [{ userId }]
        }
      };

      if (status !== 'all') {
        whereClause.status = status;
      }

      const wallets = await MultisigWallet.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['createdAt', 'DESC']]
      });

      const walletsWithUserRole = wallets.rows.map(wallet => {
        const participant = wallet.participants.find(p => p.userId === userId);
        return {
          id: wallet.id,
          walletId: wallet.walletId,
          name: wallet.name,
          description: wallet.description,
          threshold: wallet.threshold,
          participantCount: wallet.participants.filter(p => p.status === 'active').length,
          balance: wallet.balance,
          status: wallet.status,
          userRole: participant?.role,
          userPermissions: participant?.permissions,
          userStatus: participant?.status,
          createdAt: wallet.createdAt,
          isCreator: wallet.createdBy === userId
        };
      });

      // Filtrar por role se especificado
      const filteredWallets = role 
        ? walletsWithUserRole.filter(w => w.userRole === role)
        : walletsWithUserRole;

      res.json({
        status: 'success',
        data: {
          wallets: filteredWallets,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: wallets.count,
            pages: Math.ceil(wallets.count / parseInt(limit))
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

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

// Funcionalidades avançadas de administração

// Atualizar configurações administrativas da carteira
MultisigWalletController.updateAdminSettings = async (req, res, next) => {
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
    const adminSettings = req.body;
    const userId = req.user.id;

    const wallet = await MultisigWallet.findByPk(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Verificar se o usuário tem permissão para modificar configurações
    if (!wallet.hasPermission(userId, 'modify_settings')) {
      return res.status(403).json({
        status: 'error',
        message: 'Apenas administradores podem modificar configurações da carteira'
      });
    }

    // Atualizar configurações
    wallet.updateAdminSettings(adminSettings, userId);
    await wallet.save();

    res.json({
      status: 'success',
      message: 'Configurações administrativas atualizadas com sucesso',
      data: {
        walletId: wallet.walletId,
        adminSettings: wallet.adminSettings,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};

// Atualizar role de um participante
MultisigWalletController.updateParticipantRole = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Dados de entrada inválidos',
        errors: errors.array()
      });
    }

    const { walletId, userId: targetUserId } = req.params;
    const { role } = req.body;
    const adminUserId = req.user.id;

    const wallet = await MultisigWallet.findByPk(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Verificar se o usuário é admin
    if (!wallet.isAdmin(adminUserId)) {
      return res.status(403).json({
        status: 'error',
        message: 'Apenas administradores podem alterar roles de participantes'
      });
    }

    // Não permitir alterar o role do criador da carteira
    if (wallet.createdBy === targetUserId) {
      return res.status(400).json({
        status: 'error',
        message: 'Não é possível alterar o role do criador da carteira'
      });
    }

    // Atualizar role
    wallet.updateParticipantRole(targetUserId, role, adminUserId);
    await wallet.save();

    res.json({
      status: 'success',
      message: 'Role do participante atualizado com sucesso',
      data: {
        walletId: wallet.walletId,
        userId: targetUserId,
        newRole: role,
        updatedBy: adminUserId,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }
    next(error);
  }
};

// Configurar limites da carteira
MultisigWalletController.updateWalletLimits = async (req, res, next) => {
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
    const limits = req.body;
    const userId = req.user.id;

    const wallet = await MultisigWallet.findByPk(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Verificar permissões
    if (!wallet.hasPermission(userId, 'modify_settings')) {
      return res.status(403).json({
        status: 'error',
        message: 'Apenas administradores podem modificar limites da carteira'
      });
    }

    // Atualizar limites
    wallet.limits = { ...wallet.limits, ...limits };
    await wallet.save();

    res.json({
      status: 'success',
      message: 'Limites da carteira atualizados com sucesso',
      data: {
        walletId: wallet.walletId,
        limits: wallet.limits,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};

// Configurar regras de divisão de fundos
MultisigWalletController.updateDivisionRules = async (req, res, next) => {
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
    const divisionRules = req.body;
    const userId = req.user.id;

    const wallet = await MultisigWallet.findByPk(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Verificar permissões
    if (!wallet.hasPermission(userId, 'modify_settings')) {
      return res.status(403).json({
        status: 'error',
        message: 'Apenas administradores podem configurar regras de divisão'
      });
    }

    // Validar regras de divisão
    if (divisionRules.enabled && divisionRules.rules) {
      const totalPercentage = divisionRules.rules.reduce((sum, rule) => sum + rule.percentage, 0);
      if (totalPercentage !== 100) {
        return res.status(400).json({
          status: 'error',
          message: 'A soma das porcentagens deve ser igual a 100%'
        });
      }
    }

    // Atualizar regras
    wallet.divisionRules = { ...wallet.divisionRules, ...divisionRules };
    await wallet.save();

    res.json({
      status: 'success',
      message: 'Regras de divisão atualizadas com sucesso',
      data: {
        walletId: wallet.walletId,
        divisionRules: wallet.divisionRules,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};

// Alterar status da carteira (ativar/desativar/congelar)
MultisigWalletController.updateWalletStatus = async (req, res, next) => {
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
    const { status, reason } = req.body;
    const userId = req.user.id;

    const wallet = await MultisigWallet.findByPk(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Apenas super admin pode alterar status
    if (!wallet.isSuperAdmin(userId)) {
      return res.status(403).json({
        status: 'error',
        message: 'Apenas o criador da carteira pode alterar seu status'
      });
    }

    const oldStatus = wallet.status;
    wallet.status = status;

    // Adicionar ao log de auditoria
    const auditLog = wallet.auditLog || [];
    auditLog.push({
      action: 'status_changed',
      userId,
      timestamp: new Date(),
      oldStatus,
      newStatus: status,
      reason
    });
    wallet.auditLog = auditLog;

    await wallet.save();

    res.json({
      status: 'success',
      message: `Status da carteira alterado para ${status}`,
      data: {
        walletId: wallet.walletId,
        oldStatus,
        newStatus: status,
        reason,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};

// Obter estatísticas administrativas da carteira
MultisigWalletController.getAdminStatistics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Buscar todas as carteiras onde o usuário é admin
    const adminWallets = await MultisigWallet.find({
      'participants.userId': userId,
      'participants.role': 'admin'
    }).populate('participants.userId', 'name email');

    const statistics = {
      totalWallets: adminWallets.length,
      activeWallets: adminWallets.filter(w => w.status === 'active').length,
      frozenWallets: adminWallets.filter(w => w.status === 'frozen').length,
      totalParticipants: adminWallets.reduce((sum, w) => sum + w.participantCount, 0),
      totalBalance: adminWallets.reduce((sum, w) => sum + parseFloat(w.balance || 0), 0),
      walletsByThreshold: adminWallets.reduce((acc, w) => {
        acc[w.threshold] = (acc[w.threshold] || 0) + 1;
        return acc;
      }, {}),
      recentActivity: adminWallets.map(w => ({
        walletId: w.walletId,
        name: w.name,
        lastActivity: w.updatedAt,
        status: w.status,
        participantCount: w.participantCount
      })).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)).slice(0, 10)
    };

    res.json({
      status: 'success',
      data: { statistics }
    });

  } catch (error) {
    next(error);
  }
};

// Métodos administrativos avançados
MultisigWalletController.emergencyFreeze = async (req, res, next) => {
  const auditService = new AuditService();
  
  try {
    const { walletId } = req.params;
    const { reason, duration = 24 } = req.body; // duração padrão: 24 horas
    const userId = req.user.id;

    const wallet = await MultisigWallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Verificar se já está congelada
    if (wallet.status === 'frozen') {
      return res.status(400).json({
        status: 'error',
        message: 'Carteira já está congelada'
      });
    }

    const oldStatus = wallet.status;
    const freezeUntil = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Congelar carteira
    wallet.status = 'frozen';
    wallet.frozenAt = new Date();
    wallet.frozenBy = userId;
    wallet.frozenReason = reason;
    wallet.frozenUntil = freezeUntil;
    await wallet.save();

    // Log de auditoria
    await auditService.logWalletAction({
      action: 'emergency_freeze',
      walletId: wallet.walletId,
      oldValues: { status: oldStatus },
      newValues: { 
        status: 'frozen',
        frozenReason: reason,
        frozenUntil: freezeUntil
      },
      metadata: {
        adminEmail: req.user.email,
        reason,
        duration,
        emergencyAction: true
      },
      severity: 'critical'
    }, { req, user: req.user });

    res.json({
      status: 'success',
      message: 'Carteira congelada em emergência',
      data: {
        wallet: {
          id: wallet._id,
          walletId: wallet.walletId,
          status: wallet.status,
          frozenAt: wallet.frozenAt,
          frozenUntil: wallet.frozenUntil,
          frozenReason: reason
        }
      }
    });

  } catch (error) {
    await auditService.logFailedAction({
      action: 'emergency_freeze',
      resourceType: 'wallet',
      resourceId: req.params.walletId,
      error,
      metadata: req.body
    }, { req, user: req.user });

    next(error);
  }
};

MultisigWalletController.emergencyUnfreeze = async (req, res, next) => {
  const auditService = new AuditService();
  
  try {
    const { walletId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const wallet = await MultisigWallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    if (wallet.status !== 'frozen') {
      return res.status(400).json({
        status: 'error',
        message: 'Carteira não está congelada'
      });
    }

    const oldValues = {
      status: wallet.status,
      frozenAt: wallet.frozenAt,
      frozenReason: wallet.frozenReason
    };

    // Descongelar carteira
    wallet.status = 'active';
    wallet.frozenAt = null;
    wallet.frozenBy = null;
    wallet.frozenReason = null;
    wallet.frozenUntil = null;
    wallet.unfrozenAt = new Date();
    wallet.unfrozenBy = userId;
    wallet.unfrozenReason = reason;
    await wallet.save();

    // Log de auditoria
    await auditService.logWalletAction({
      action: 'emergency_unfreeze',
      walletId: wallet.walletId,
      oldValues,
      newValues: { 
        status: 'active',
        unfrozenReason: reason,
        unfrozenAt: new Date()
      },
      metadata: {
        adminEmail: req.user.email,
        reason,
        emergencyAction: true
      },
      severity: 'high'
    }, { req, user: req.user });

    res.json({
      status: 'success',
      message: 'Carteira descongelada com sucesso',
      data: {
        wallet: {
          id: wallet._id,
          walletId: wallet.walletId,
          status: wallet.status,
          unfrozenAt: wallet.unfrozenAt,
          unfrozenReason: reason
        }
      }
    });

  } catch (error) {
    await auditService.logFailedAction({
      action: 'emergency_unfreeze',
      resourceType: 'wallet',
      resourceId: req.params.walletId,
      error,
      metadata: req.body
    }, { req, user: req.user });

    next(error);
  }
};

MultisigWalletController.bulkUpdatePermissions = async (req, res, next) => {
  const auditService = new AuditService();
  
  try {
    const { walletId } = req.params;
    const { updates, reason } = req.body;
    const userId = req.user.id;

    const wallet = await MultisigWallet.findById(walletId).populate('participants.userId');
    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    const results = [];
    const oldPermissions = {};

    // Processar cada atualização
    for (const update of updates) {
      const { participantId, permissions } = update;
      
      const participantIndex = wallet.participants.findIndex(p => 
        p.userId._id.toString() === participantId
      );
      
      if (participantIndex === -1) {
        results.push({
          participantId,
          success: false,
          error: 'Participante não encontrado'
        });
        continue;
      }

      // Salvar permissões antigas
      oldPermissions[participantId] = [...wallet.participants[participantIndex].permissions];

      try {
        // Atualizar permissões
        wallet.participants[participantIndex].permissions = permissions;
        
        results.push({
          participantId,
          success: true,
          oldPermissions: oldPermissions[participantId],
          newPermissions: permissions
        });

      } catch (error) {
        results.push({
          participantId,
          success: false,
          error: error.message
        });
      }
    }

    await wallet.save();

    // Log de auditoria
    await auditService.logWalletAction({
      action: 'bulk_update_permissions',
      walletId: wallet.walletId,
      oldValues: { permissions: oldPermissions },
      newValues: { 
        permissions: results.reduce((acc, r) => {
          if (r.success) {
            acc[r.participantId] = r.newPermissions;
          }
          return acc;
        }, {})
      },
      metadata: {
        adminEmail: req.user.email,
        reason,
        updatesCount: updates.length,
        successCount: results.filter(r => r.success).length,
        results
      },
      severity: 'high'
    }, { req, user: req.user });

    res.json({
      status: 'success',
      message: 'Atualização em lote de permissões concluída',
      data: {
        results,
        summary: {
          total: updates.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }
    });

  } catch (error) {
    await auditService.logFailedAction({
      action: 'bulk_update_permissions',
      resourceType: 'wallet',
      resourceId: req.params.walletId,
      error,
      metadata: req.body
    }, { req, user: req.user });

    next(error);
  }
};

MultisigWalletController.getSecurityAnalysis = async (req, res, next) => {
  try {
    const { walletId } = req.params;

    const wallet = await MultisigWallet.findById(walletId)
      .populate('participants.userId', 'name email lastActivity')
      .populate('transactions');

    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Carteira não encontrada'
      });
    }

    // Análise de segurança
    const analysis = {
      walletInfo: {
        id: wallet._id,
        walletId: wallet.walletId,
        name: wallet.name,
        threshold: wallet.threshold,
        participantCount: wallet.participantCount,
        status: wallet.status,
        createdAt: wallet.createdAt
      },
      
      securityScore: MultisigWalletController.calculateSecurityScore(wallet),
      
      riskFactors: MultisigWalletController.identifyRiskFactors(wallet),
      
      participantAnalysis: wallet.participants.map(p => ({
        id: p.userId._id,
        email: p.userId.email,
        role: p.role,
        permissions: p.permissions,
        joinedAt: p.joinedAt,
        lastActivity: p.userId.lastActivity,
        riskLevel: MultisigWalletController.calculateParticipantRisk(p, wallet)
      })),
      
      transactionAnalysis: {
        total: wallet.transactions?.length || 0,
        pending: wallet.transactions?.filter(t => t.status === 'pending').length || 0,
        approved: wallet.transactions?.filter(t => t.status === 'approved').length || 0,
        executed: wallet.transactions?.filter(t => t.status === 'executed').length || 0,
        rejected: wallet.transactions?.filter(t => t.status === 'rejected').length || 0
      },
      
      recommendations: MultisigWalletController.generateSecurityRecommendations(wallet),
      
      complianceStatus: MultisigWalletController.checkComplianceStatus(wallet),
      
      generatedAt: new Date(),
      generatedBy: req.user.email
    };

    res.json({
      status: 'success',
      data: { analysis }
    });

  } catch (error) {
    next(error);
  }
};

// Métodos auxiliares para análise de segurança
MultisigWalletController.calculateSecurityScore = (wallet) => {
  let score = 100;
  
  // Penalizar por threshold baixo
  if (wallet.threshold < wallet.participantCount * 0.5) {
    score -= 20;
  }
  
  // Penalizar por muitos administradores
  const adminCount = wallet.participants.filter(p => p.role === 'admin').length;
  if (adminCount > 2) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
};

MultisigWalletController.identifyRiskFactors = (wallet) => {
  const risks = [];
  
  if (wallet.threshold === 1) {
    risks.push({
      type: 'low_threshold',
      severity: 'high',
      description: 'Threshold muito baixo (1) oferece pouca segurança'
    });
  }
  
  const adminCount = wallet.participants.filter(p => p.role === 'admin').length;
  if (adminCount > wallet.participantCount * 0.5) {
    risks.push({
      type: 'too_many_admins',
      severity: 'medium',
      description: 'Muitos administradores podem comprometer a segurança'
    });
  }
  
  if (wallet.status === 'frozen') {
    risks.push({
      type: 'frozen_wallet',
      severity: 'high',
      description: 'Carteira está congelada'
    });
  }
  
  return risks;
};

MultisigWalletController.calculateParticipantRisk = (participant, wallet) => {
  let riskScore = 0;
  
  // Verificar última atividade
  if (participant.userId.lastActivity) {
    const daysSinceActivity = (Date.now() - new Date(participant.userId.lastActivity)) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 90) riskScore += 3;
    else if (daysSinceActivity > 30) riskScore += 1;
  }
  
  // Verificar permissões excessivas
  if (participant.permissions.length > 5) riskScore += 2;
  
  if (riskScore >= 5) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
};

MultisigWalletController.generateSecurityRecommendations = (wallet) => {
  const recommendations = [];
  
  if (wallet.threshold < wallet.participantCount * 0.6) {
    recommendations.push({
      type: 'increase_threshold',
      priority: 'high',
      description: 'Considere aumentar o threshold para melhor segurança',
      action: `Aumente o threshold para pelo menos ${Math.ceil(wallet.participantCount * 0.6)}`
    });
  }
  
  return recommendations;
};

MultisigWalletController.checkComplianceStatus = (wallet) => {
  const compliance = {
    overall: 'compliant',
    checks: []
  };
  
  // Verificar se há pelo menos 2 administradores
  const adminCount = wallet.participants.filter(p => p.role === 'admin').length;
  compliance.checks.push({
    rule: 'minimum_admins',
    status: adminCount >= 2 ? 'pass' : 'fail',
    description: 'Pelo menos 2 administradores necessários'
  });
  
  // Verificar threshold mínimo
  compliance.checks.push({
    rule: 'minimum_threshold',
    status: wallet.threshold >= 2 ? 'pass' : 'fail',
    description: 'Threshold mínimo de 2 assinaturas'
  });
  
  // Determinar status geral
  if (compliance.checks.some(check => check.status === 'fail')) {
    compliance.overall = 'non_compliant';
  }
  
  return compliance;
};

module.exports = MultisigWalletController;