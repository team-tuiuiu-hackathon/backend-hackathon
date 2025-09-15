const Transaction = require('../models/transactionModel');
const MultisigWallet = require('../models/multisigWalletModel');
const NotificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

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

  // BE08 - Assinar uma transação
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
          message: 'Apenas participantes da carteira podem assinar transações'
        });
      }

      // Adicionar assinatura
      transaction.addSignature(userId, signature, publicKey);
      await transaction.save();

      // BE09 - Verificar se atingiu o threshold
      const isReadyForExecution = transaction.isApproved;

      // BE10 - Notificar membros sobre assinatura
      try {
        if (isReadyForExecution) {
          // Notificar que a transação foi aprovada
          await NotificationService.notifyTransactionApproved(
            transaction.walletId,
            {
              transactionId: transaction.transactionId,
              type: transaction.type,
              amount: transaction.amount,
              currency: transaction.currency,
              signatureProgress: transaction.signatureProgress
            }
          );
        } else {
          // Notificar que a transação foi assinada
          await NotificationService.notifyTransactionSigned(
            transaction.walletId,
            {
              transactionId: transaction.transactionId,
              type: transaction.type,
              amount: transaction.amount,
              currency: transaction.currency,
              signatureProgress: transaction.signatureProgress
            },
            userId
          );
        }
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: isReadyForExecution ? 
          'Transação assinada e aprovada para execução' : 
          'Assinatura adicionada com sucesso',
        data: {
          transactionId: transaction.transactionId,
          signatureProgress: transaction.signatureProgress,
          status: transaction.status,
          isApproved: transaction.isApproved,
          readyForExecution: isReadyForExecution,
          signedAt: new Date()
        }
      });

    } catch (error) {
      if (error.message.includes('já assinou') || 
          error.message.includes('não está pendente') || 
          error.message.includes('expirada')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // BE09 - Executar transação aprovada
  static async executeTransaction(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { txHash, blockNumber, gasUsed } = req.body;
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
          message: 'Apenas participantes da carteira podem executar transações'
        });
      }

      // Verificar se a transação está aprovada
      if (!transaction.isApproved) {
        return res.status(400).json({
          status: 'error',
          message: 'Transação não possui assinaturas suficientes para execução'
        });
      }

      // Marcar como executada
      transaction.markAsExecuted(txHash, blockNumber, gasUsed);
      await transaction.save();

      // Atualizar saldo da carteira se for pagamento
      if (transaction.type === 'payment') {
        wallet.balance.usdc -= transaction.amount;
        wallet.balance.lastUpdated = new Date();
        await wallet.save();
      }

      // BE10 - Notificar membros sobre execução da transação
      try {
        await NotificationService.notifyTransactionExecuted(
          transaction.walletId,
          {
            transactionId: transaction.transactionId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            txHash: transaction.blockchainData.txHash,
            executedAt: transaction.executedAt
          }
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: 'Transação executada com sucesso',
        data: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          executedAt: transaction.executedAt,
          blockchainData: transaction.blockchainData
        }
      });

    } catch (error) {
      if (error.message.includes('não possui assinaturas') || 
          error.message.includes('aprovadas podem ser executadas')) {
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
      const { 
        status, 
        type, 
        page = 1, 
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
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

      // Construir query
      const query = { walletId: wallet._id };
      if (status) query.status = status;
      if (type) query.type = type;

      // Opções de paginação e ordenação
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
      };

      const transactions = await Transaction.find(query)
        .select('-auditLog -blockchainData.contractEvents')
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .sort(options.sort);

      const total = await Transaction.countDocuments(query);

      res.json({
        status: 'success',
        data: {
          transactions: transactions.map(tx => ({
            id: tx._id,
            transactionId: tx.transactionId,
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            recipient: tx.recipient,
            description: tx.description,
            status: tx.status,
            signatureProgress: tx.signatureProgress,
            proposedBy: tx.proposedBy,
            proposedAt: tx.proposedAt,
            approvedAt: tx.approvedAt,
            executedAt: tx.executedAt,
            expiresAt: tx.expiresAt,
            isExpired: tx.isExpired
          })),
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