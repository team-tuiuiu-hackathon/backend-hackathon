const Transaction = require('../models/transactionModel');
const MultisigWallet = require('../models/multisigWalletModel');
const NotificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const AuditService = require('../services/auditService');

class TransactionController {

  // BE06 - Propor uma transação
  static async proposeTransaction(req, res, next) {
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
      const { type, amount, currency, recipient, description, metadata } = req.body;
      const proposedBy = req.user.id;

      // Verificar se a carteira existe
      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é participante da carteira
      const participants = wallet.participants || [];
      const isParticipant = participants.some(p => p.userId === proposedBy);
      if (!isParticipant) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas participantes podem propor transações'
        });
      }

      // Validações específicas por tipo de transação
      if (type === 'payment' && (!amount || !recipient?.address)) {
        return res.status(400).json({
          status: 'error',
          message: 'Pagamentos requerem valor e endereço do destinatário'
        });
      }

      // Verificar saldo para pagamentos
      if (type === 'payment' && wallet.balance.usdc < amount) {
        return res.status(400).json({
          status: 'error',
          message: 'Saldo insuficiente na carteira'
        });
      }

      // Criar a transação
      const transactionData = {
        transactionId: uuidv4(),
        walletId: wallet._id,
        type,
        amount,
        currency: currency || 'USDC',
        recipient,
        description,
        metadata: metadata || {},
        requiredSignatures: wallet.threshold,
        proposedBy,
        auditLog: [{
          action: 'created',
          userId: proposedBy,
          timestamp: new Date(),
          details: { type, amount, currency },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }]
      };

      const transaction = new Transaction(transactionData);
      await transaction.save();

      // BE10 - Notificar membros da carteira sobre nova transação proposta
      try {
        await NotificationService.notifyTransactionProposed(
          walletId, 
          {
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            recipient: transaction.recipient
          },
          req.user.id
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
        // Não falhar a transação por erro de notificação
      }

      res.status(201).json({
        status: 'success',
        message: 'Transação proposta com sucesso',
        data: {
          transaction: {
            id: transaction._id,
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            recipient: transaction.recipient,
            description: transaction.description,
            status: transaction.status,
            requiredSignatures: transaction.requiredSignatures,
            signatureProgress: transaction.signatureProgress,
            proposedBy: transaction.proposedBy,
            proposedAt: transaction.proposedAt,
            expiresAt: transaction.expiresAt
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE08 - Assinar uma transação (versão simplificada)
  static async signTransaction(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { transactionId } = req.params;
      const { signature, publicKey } = req.body;
      const userId = req.user.id;

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se o usuário pode assinar
      const canSignResult = await transaction.canUserSign(userId);
      if (!canSignResult.canSign) {
        return res.status(403).json({
          status: 'error',
          message: canSignResult.reason
        });
      }

      // Adicionar assinatura
      await transaction.addSignature(userId, signature, publicKey);

      // Verificar se está totalmente aprovada
      const isFullyApproved = transaction.isFullyApproved();
      
      if (isFullyApproved) {
        await transaction.approve(userId);
      }

      res.json({
        status: 'success',
        message: isFullyApproved ? 'Transação assinada e aprovada' : 'Transação assinada com sucesso',
        data: {
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            status: transaction.status,
            signatureCount: transaction.signatures.length,
            requiredSignatures: transaction.requiredSignatures,
            isFullyApproved
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE08 - Assinar uma transação (versão avançada)
  static async signTransactionEnhanced(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { transactionId } = req.params;
      const { signature, publicKey } = req.body;
      const userId = req.user.id;

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se o usuário pode assinar
      const canSignResult = await transaction.canUserSign(userId);
      if (!canSignResult.canSign) {
        return res.status(403).json({
          status: 'error',
          message: canSignResult.reason
        });
      }

      // Adicionar assinatura usando o método do modelo
      await transaction.addSignature(userId, signature, publicKey);

      // Verificar se a transação está totalmente aprovada
      const isFullyApproved = transaction.isFullyApproved();
      
      if (isFullyApproved) {
        await transaction.approve(userId);
      }

      // Notificar membros
      try {
        const wallet = await MultisigWallet.findByPk(transaction.walletId);
        if (isFullyApproved) {
          await NotificationService.notifyTransactionApproved(
            transaction.walletId,
            {
              transactionId: transaction.transactionId,
              type: transaction.type,
              amount: transaction.amount,
              currency: transaction.currency
            }
          );
        } else {
          await NotificationService.notifyTransactionSigned(
            transaction.walletId,
            {
              transactionId: transaction.transactionId,
              type: transaction.type,
              amount: transaction.amount,
              currency: transaction.currency,
              signatureCount: transaction.signatures.length,
              requiredSignatures: transaction.requiredSignatures
            },
            userId
          );
        }
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: isFullyApproved ? 'Transação assinada e aprovada' : 'Transação assinada com sucesso',
        data: {
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            status: transaction.status,
            signatureCount: transaction.signatures.length,
            requiredSignatures: transaction.requiredSignatures,
            isFullyApproved,
            approvedAt: transaction.approvedAt
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Remover assinatura de transação
  static async removeSignature(req, res, next) {
    try {
      const { transactionId, userId: targetUserId } = req.params;
      const removedBy = req.user.id;

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar permissões - apenas admin ou o próprio usuário pode remover
      const wallet = await MultisigWallet.findByPk(transaction.walletId);
      const isAdmin = wallet.isAdmin(removedBy);
      const isSelfRemoval = removedBy === targetUserId;

      if (!isAdmin && !isSelfRemoval) {
        return res.status(403).json({
          status: 'error',
          message: 'Sem permissão para remover esta assinatura'
        });
      }

      await transaction.removeSignature(targetUserId, removedBy);

      res.json({
        status: 'success',
        message: 'Assinatura removida com sucesso',
        data: {
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            signatureCount: transaction.signatures.length,
            requiredSignatures: transaction.requiredSignatures
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE09 - Executar transação aprovada
  static async executeTransaction(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se a transação está aprovada
      if (transaction.status !== 'approved') {
        return res.status(400).json({
          status: 'error',
          message: 'Transação deve estar aprovada para ser executada'
        });
      }

      // Verificar se o usuário tem permissão para executar
      const wallet = await MultisigWallet.findByPk(transaction.walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      const participants = wallet.participants || [];
      const isParticipant = participants.some(p => p.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas participantes podem executar transações'
        });
      }

      // Executar a transação
      const blockchainResult = {
        transactionHash: `0x${Date.now().toString(16)}`, // Simulado
        blockNumber: Math.floor(Math.random() * 1000000),
        gasUsed: Math.floor(Math.random() * 50000) + 21000
      };

      await transaction.execute(userId, blockchainResult);

      res.json({
        status: 'success',
        message: 'Transação executada com sucesso',
        data: {
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            status: transaction.status,
            executedAt: transaction.executedAt,
            blockchainData: transaction.blockchainData
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Aprovar transação manualmente (para admins)
  static async approveTransaction(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const approvedBy = req.user.id;

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se o usuário é admin
      const wallet = await MultisigWallet.findByPk(transaction.walletId);
      if (!wallet.isAdmin(approvedBy)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem aprovar transações manualmente'
        });
      }

      await transaction.approve(approvedBy);

      // Adicionar razão da aprovação manual ao log
      if (reason) {
        const auditLog = transaction.auditLog || [];
        auditLog.push({
          action: 'manual_approval_reason',
          userId: approvedBy,
          timestamp: new Date(),
          details: { reason }
        });
        transaction.auditLog = auditLog;
        await transaction.save();
      }

      // Notificar membros
      try {
        await NotificationService.notifyTransactionApproved(
          transaction.walletId,
          {
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            approvalType: 'manual',
            approvedBy
          }
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: 'Transação aprovada manualmente',
        data: {
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            status: transaction.status,
            approvedAt: transaction.approvedAt,
            approvedBy
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Rejeitar transação com razão detalhada
  static async rejectTransactionEnhanced(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const rejectedBy = req.user.id;

      if (!reason) {
        return res.status(400).json({
          status: 'error',
          message: 'Razão da rejeição é obrigatória'
        });
      }

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar permissões - participante ou admin
      const wallet = await MultisigWallet.findByPk(transaction.walletId);
      const isParticipant = wallet.participants.some(p => p.userId === rejectedBy);
      const isAdmin = wallet.isAdmin(rejectedBy);

      if (!isParticipant && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Sem permissão para rejeitar esta transação'
        });
      }

      await transaction.reject(rejectedBy, reason);

      // Notificar membros
      try {
        await NotificationService.notifyTransactionRejected(
          transaction.walletId,
          {
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            reason,
            rejectedBy
          }
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: 'Transação rejeitada',
        data: {
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            status: transaction.status,
            rejectedBy,
            reason
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Obter histórico de aprovações de uma transação
  static async getTransactionApprovalHistory(req, res, next) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await Transaction.findOne({ 
        where: { transactionId } 
      });
      
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se o usuário tem acesso à carteira
      const wallet = await MultisigWallet.findByPk(transaction.walletId);
      const hasAccess = wallet.participants.some(p => p.userId === userId) || 
                       wallet.isAdmin(userId);

      if (!hasAccess) {
        return res.status(403).json({
          status: 'error',
          message: 'Sem permissão para visualizar esta transação'
        });
      }

      const approvalHistory = {
        transactionId: transaction.transactionId,
        status: transaction.status,
        signatures: transaction.signatures || [],
        requiredSignatures: transaction.requiredSignatures,
        auditLog: transaction.auditLog || [],
        timeline: {
          proposedAt: transaction.proposedAt,
          approvedAt: transaction.approvedAt,
          executedAt: transaction.executedAt,
          expiresAt: transaction.expiresAt
        }
      };

      res.json({
        status: 'success',
        data: { approvalHistory }
      });

    } catch (error) {
      next(error);
    }
  }

  // Obter detalhes de uma transação específica
  static async getTransactionDetails(req, res, next) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se o usuário é participante da carteira
      const wallet = await MultisigWallet.findById(transaction.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado: você não é participante desta carteira'
        });
      }

      res.json({
        status: 'success',
        data: {
          transaction: {
            id: transaction._id,
            transactionId: transaction.transactionId,
            walletId: transaction.walletId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            recipient: transaction.recipient,
            sender: transaction.sender,
            description: transaction.description,
            metadata: transaction.metadata,
            status: transaction.status,
            signatures: transaction.signatures.map(sig => ({
              userId: sig.userId,
              signedAt: sig.signedAt,
              publicKey: sig.publicKey
            })),
            requiredSignatures: transaction.requiredSignatures,
            signatureProgress: transaction.signatureProgress,
            proposedBy: transaction.proposedBy,
            proposedAt: transaction.proposedAt,
            approvedAt: transaction.approvedAt,
            executedAt: transaction.executedAt,
            expiresAt: transaction.expiresAt,
            isExpired: transaction.isExpired,
            blockchainData: transaction.blockchainData,
            auditLog: transaction.auditLog
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Rejeitar uma transação (apenas para admins)
  static async rejectTransaction(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      // Verificar se o usuário é admin da carteira
      const wallet = await MultisigWallet.findById(transaction.walletId);
      if (!wallet.isAdmin(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem rejeitar transações'
        });
      }

      // Rejeitar transação
      transaction.reject(userId, reason);
      await transaction.save();

      // BE10 - Notificar membros sobre rejeição da transação
      try {
        await NotificationService.notifyTransactionRejected(
          transaction.walletId,
          {
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            reason: reason
          },
          userId
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: 'Transação rejeitada com sucesso',
        data: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          rejectedBy: userId,
          reason
        }
      });

    } catch (error) {
      if (error.message.includes('pendentes podem ser rejeitadas')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // BE07 - Listar transações de uma carteira
  static async getWalletTransactions(req, res, next) {
    try {
      const { walletId } = req.params;
      const { status, type, page = 1, limit = 10 } = req.query;
      const userId = req.user.id;

      // Verificar se a carteira existe
      const wallet = await MultisigWallet.findByPk(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      // Verificar se o usuário é participante da carteira
      const participants = wallet.participants || [];
      const isParticipant = participants.some(p => p.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas participantes podem visualizar transações'
        });
      }

      // Construir filtros
      const whereClause = { walletId: wallet.id };
      if (status) {
        whereClause.status = status;
      }
      if (type) {
        whereClause.type = type;
      }

      // Calcular offset para paginação
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Buscar transações
      const { rows: transactions, count } = await Transaction.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        status: 'success',
        data: {
          transactions: transactions.map(tx => ({
            id: tx.id,
            transactionId: tx.transactionId,
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            recipient: tx.recipient,
            description: tx.description,
            status: tx.status,
            proposedBy: tx.proposedBy,
            signatures: tx.signatures || [],
            requiredSignatures: tx.requiredSignatures,
            createdAt: tx.createdAt,
            updatedAt: tx.updatedAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / parseInt(limit))
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Obter estatísticas de transações da carteira
  static async getWalletTransactionStats(req, res, next) {
    try {
      const { walletId } = req.params;
      const userId = req.user.id;

      // Verificar se a carteira existe e se o usuário é participante
      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado: você não é participante desta carteira'
        });
      }

      // Agregar estatísticas
      const stats = await Transaction.aggregate([
        { $match: { walletId: wallet._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const typeStats = await Transaction.aggregate([
        { $match: { walletId: wallet._id } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      res.json({
        status: 'success',
        data: {
          walletId: wallet.walletId,
          statusStats: stats,
          typeStats: typeStats,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = TransactionController;