const Payment = require('../models/paymentModel');
const MultisigWallet = require('../models/multisigWalletModel');
const NotificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

class PaymentController {

  // BE17 - Propor pagamento em USDC
  static async proposePayment(req, res, next) {
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
      const { 
        recipientAddress, 
        recipientName, 
        recipientEmail,
        amount, 
        memo, 
        category = 'other',
        externalReference 
      } = req.body;
      const userId = req.user.id;

      // Verificar se a carteira existe
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
          message: 'Apenas participantes da carteira podem propor pagamentos'
        });
      }

      // Verificar se a carteira tem saldo suficiente
      const paymentAmount = parseFloat(amount);
      if (wallet.balance.usdc < paymentAmount) {
        return res.status(400).json({
          status: 'error',
          message: 'Saldo insuficiente na carteira',
          data: {
            available: `${wallet.balance.usdc.toFixed(6)} USDC`,
            requested: `${paymentAmount.toFixed(6)} USDC`
          }
        });
      }

      // Criar dados do pagamento
      const paymentData = {
        paymentId: uuidv4(),
        walletId,
        proposedBy: userId,
        recipient: {
          address: recipientAddress,
          name: recipientName,
          email: recipientEmail
        },
        amount: paymentAmount,
        currency: 'USDC',
        status: 'proposed',
        metadata: {
          memo,
          category,
          externalReference,
          userIP: req.ip,
          userAgent: req.get('User-Agent')
        }
      };

      // Salvar pagamento no banco
      const payment = new Payment(paymentData);
      await payment.save();

      // Notificar membros da carteira sobre nova proposta de pagamento
      try {
        await NotificationService.notifyWalletMembers(
          walletId,
          'payment_proposed',
          {
            transactionData: {
              paymentId: payment.paymentId,
              type: 'payment',
              amount: payment.amount,
              currency: payment.currency,
              recipient: payment.recipient.address
            }
          },
          userId
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.status(201).json({
        status: 'success',
        message: 'Pagamento proposto com sucesso',
        data: {
          paymentId: payment.paymentId,
          amount: payment.formattedAmount,
          recipient: payment.recipient,
          status: payment.status,
          signatureProgress: payment.signatureProgress,
          expiresAt: payment.expiresAt
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE18 - Assinar proposta de pagamento
  static async signPayment(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { paymentId } = req.params;
      const { signature, publicKey } = req.body;
      const userId = req.user.id;

      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Pagamento não encontrado'
        });
      }

      // Verificar se o usuário é participante da carteira
      const wallet = await MultisigWallet.findById(payment.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas participantes da carteira podem assinar pagamentos'
        });
      }

      // Adicionar assinatura
      payment.addSignature(userId, signature, publicKey);
      await payment.save();

      // Verificar se atingiu o threshold
      const isApproved = payment.hasEnoughSignatures;

      // Notificar sobre assinatura ou aprovação
      try {
        if (isApproved) {
          await NotificationService.notifyWalletMembers(
            payment.walletId,
            'payment_approved',
            {
              transactionData: {
                paymentId: payment.paymentId,
                type: 'payment',
                amount: payment.amount,
                currency: payment.currency,
                recipient: payment.recipient.address,
                signatureProgress: payment.signatureProgress
              }
            }
          );
        } else {
          await NotificationService.notifyWalletMembers(
            payment.walletId,
            'payment_signed',
            {
              transactionData: {
                paymentId: payment.paymentId,
                type: 'payment',
                amount: payment.amount,
                currency: payment.currency,
                recipient: payment.recipient.address,
                signatureProgress: payment.signatureProgress
              }
            },
            userId
          );
        }
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: isApproved ? 
          'Pagamento assinado e aprovado para execução' : 
          'Assinatura adicionada com sucesso',
        data: {
          paymentId: payment.paymentId,
          signatureProgress: payment.signatureProgress,
          status: payment.status,
          isApproved: payment.isApproved,
          approvedAt: payment.approvedAt
        }
      });

    } catch (error) {
      if (error.message.includes('já assinou') || 
          error.message.includes('propostos podem ser assinados')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // BE18 - Executar pagamento aprovado
  static async executePayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { txHash, blockNumber, gasUsed, fee } = req.body;
      const userId = req.user.id;

      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Pagamento não encontrado'
        });
      }

      // Verificar se o usuário é participante da carteira
      const wallet = await MultisigWallet.findById(payment.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas participantes da carteira podem executar pagamentos'
        });
      }

      // Verificar se o pagamento está aprovado
      if (payment.status !== 'approved') {
        return res.status(400).json({
          status: 'error',
          message: 'Pagamento não está aprovado para execução'
        });
      }

      // Marcar como executando primeiro
      payment.markAsExecuting();
      await payment.save();

      try {
        // Aqui seria feita a chamada para o contrato Soroban
        // Por enquanto, simulamos a execução
        
        // Marcar como completado
        payment.markAsCompleted(txHash, blockNumber, gasUsed, fee);
        await payment.save();

        // Atualizar saldo da carteira
        wallet.balance.usdc -= payment.amount;
        wallet.balance.lastUpdated = new Date();
        await wallet.save();

        // Notificar sobre execução
        try {
          await NotificationService.notifyWalletMembers(
            payment.walletId,
            'payment_executed',
            {
              transactionData: {
                paymentId: payment.paymentId,
                type: 'payment',
                amount: payment.amount,
                currency: payment.currency,
                recipient: payment.recipient.address,
                txHash: payment.blockchainData.txHash
              }
            }
          );
        } catch (notificationError) {
          console.error('Erro ao enviar notificações:', notificationError);
        }

        res.json({
          status: 'success',
          message: 'Pagamento executado com sucesso',
          data: {
            paymentId: payment.paymentId,
            status: payment.status,
            executedAt: payment.executedAt,
            completedAt: payment.completedAt,
            blockchainData: payment.blockchainData
          }
        });

      } catch (executionError) {
        // Se falhou na execução, marcar como falhou
        payment.markAsFailed(executionError.message);
        await payment.save();

        return res.status(500).json({
          status: 'error',
          message: 'Falha na execução do pagamento',
          error: executionError.message
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // Listar pagamentos de uma carteira
  static async getWalletPayments(req, res, next) {
    try {
      const { walletId } = req.params;
      const { 
        status, 
        page = 1, 
        limit = 20, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;
      const userId = req.user.id;

      // Verificar acesso à carteira
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
          message: 'Acesso negado'
        });
      }

      // Construir query
      const query = { walletId };
      if (status) {
        query.status = status;
      }

      // Executar consulta com paginação
      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        Payment.countDocuments(query)
      ]);

      res.json({
        status: 'success',
        data: {
          payments: payments.map(payment => ({
            paymentId: payment.paymentId,
            amount: payment.formattedAmount,
            recipient: payment.recipient,
            status: payment.status,
            signatureProgress: payment.signatureProgress,
            proposedBy: {
              id: payment.proposedBy._id,
              name: payment.proposedBy.name
            },
            memo: payment.metadata.memo,
            category: payment.metadata.category,
            createdAt: payment.createdAt,
            approvedAt: payment.approvedAt,
            completedAt: payment.completedAt
          })),
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            hasNext: page * limit < total,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Obter detalhes de um pagamento específico
  static async getPaymentDetails(req, res, next) {
    try {
      const { paymentId } = req.params;
      const userId = req.user.id;

      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Pagamento não encontrado'
        });
      }

      // Verificar acesso à carteira
      const wallet = await MultisigWallet.findById(payment.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado'
        });
      }

      res.json({
        status: 'success',
        data: {
          paymentId: payment.paymentId,
          walletId: payment.walletId,
          walletName: payment.walletId.name,
          amount: payment.formattedAmount,
          recipient: payment.recipient,
          status: payment.status,
          proposedBy: {
            id: payment.proposedBy._id,
            name: payment.proposedBy.name,
            email: payment.proposedBy.email
          },
          signatures: payment.signatures.map(sig => ({
            userId: sig.userId._id,
            userName: sig.userId.name,
            signedAt: sig.signedAt
          })),
          signatureProgress: payment.signatureProgress,
          blockchainData: payment.blockchainData,
          metadata: payment.metadata,
          rejection: payment.rejection,
          createdAt: payment.createdAt,
          approvedAt: payment.approvedAt,
          executedAt: payment.executedAt,
          completedAt: payment.completedAt,
          expiresAt: payment.expiresAt
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Rejeitar pagamento
  static async rejectPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Pagamento não encontrado'
        });
      }

      // Verificar se o usuário é admin da carteira
      const wallet = await MultisigWallet.findById(payment.walletId);
      if (!wallet.isAdmin(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas administradores podem rejeitar pagamentos'
        });
      }

      // Rejeitar pagamento
      payment.reject(userId, reason);
      await payment.save();

      // Notificar sobre rejeição
      try {
        await NotificationService.notifyWalletMembers(
          payment.walletId,
          'payment_rejected',
          {
            transactionData: {
              paymentId: payment.paymentId,
              type: 'payment',
              amount: payment.amount,
              currency: payment.currency,
              recipient: payment.recipient.address,
              reason: reason
            }
          },
          userId
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificações:', notificationError);
      }

      res.json({
        status: 'success',
        message: 'Pagamento rejeitado com sucesso',
        data: {
          paymentId: payment.paymentId,
          status: payment.status,
          rejection: payment.rejection
        }
      });

    } catch (error) {
      if (error.message.includes('podem ser rejeitados')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // Obter estatísticas de pagamentos da carteira
  static async getWalletPaymentStats(req, res, next) {
    try {
      const { walletId } = req.params;
      const { period = 30 } = req.query;
      const userId = req.user.id;

      // Verificar acesso à carteira
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
          message: 'Acesso negado'
        });
      }

      // Obter estatísticas
      const stats = await Payment.getWalletStats(walletId, parseInt(period));

      // Calcular totais
      const totalPayments = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);
      const totalAmount = Object.values(stats).reduce((sum, stat) => sum + stat.totalAmount, 0);

      res.json({
        status: 'success',
        data: {
          period: parseInt(period),
          summary: {
            totalPayments,
            totalAmount: `${totalAmount.toFixed(6)} USDC`,
            averageAmount: totalPayments > 0 ? `${(totalAmount / totalPayments).toFixed(6)} USDC` : '0.000000 USDC'
          },
          byStatus: stats
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Buscar pagamentos aprovados para execução
  static async getReadyForExecution(req, res, next) {
    try {
      const { walletId } = req.params;
      const userId = req.user.id;

      // Verificar acesso à carteira
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
          message: 'Acesso negado'
        });
      }

      const readyPayments = await Payment.findReadyForExecution(walletId);

      res.json({
        status: 'success',
        data: {
          count: readyPayments.length,
          payments: readyPayments.map(payment => ({
            paymentId: payment.paymentId,
            amount: payment.formattedAmount,
            recipient: payment.recipient,
            approvedAt: payment.approvedAt,
            signatureProgress: payment.signatureProgress
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController;