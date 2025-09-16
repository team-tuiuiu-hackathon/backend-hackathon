const Deposit = require('../models/depositModel');
const MultisigWallet = require('../models/multisigWalletModel');
const NotificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class DepositController {

  // BE15 - Registrar um depósito em USDC
  static async registerDeposit(req, res, next) {
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
        amount, 
        fromAddress, 
        txHash, 
        memo,
        requiredConfirmations = 12 
      } = req.body;
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
          message: 'Apenas participantes da carteira podem registrar depósitos'
        });
      }

      // Verificar se já existe um depósito com este txHash
      if (txHash) {
        const existingDeposit = await Deposit.findOne({ 
          where: { txHash } 
        });
        if (existingDeposit) {
          return res.status(409).json({
            status: 'error',
            message: 'Depósito com este hash de transação já existe',
            data: { depositId: existingDeposit.depositId }
          });
        }
      }

      // Criar dados do depósito
      const depositData = {
        depositId: uuidv4(),
        walletId,
        initiatedBy: userId,
        amount: parseFloat(amount),
        currency: 'USDC',
        status: txHash ? 'confirming' : 'pending',
        fromAddress,
        toAddress: wallet.contractAddress,
        requiredConfirmations,
        confirmations: txHash ? 1 : 0,
        txHash: txHash || null,
        memo,
        userIP: req.ip,
        userAgent: req.get('User-Agent'),
        confirmationAttempts: txHash ? 1 : 0
      };

      // Salvar depósito no banco
      const deposit = await Deposit.create(depositData);

      // BE16 - Emitir evento para frontend se txHash foi fornecido
      if (txHash) {
        try {
          // Aqui você emitiria um evento WebSocket/SSE para o frontend
          // Por exemplo: socketService.emit(`wallet:${walletId}:deposit:confirming`, deposit);
          console.log(`🔄 Depósito ${deposit.depositId} em confirmação`);
        } catch (eventError) {
          console.error('Erro ao emitir evento:', eventError);
        }
      }

      res.status(201).json({
        status: 'success',
        message: txHash ? 
          'Depósito registrado e em confirmação' : 
          'Depósito registrado, aguardando transação na blockchain',
        data: {
          depositId: deposit.depositId,
          amount: deposit.formattedAmount,
          status: deposit.status,
          confirmationProgress: deposit.confirmationProgress,
          expiresAt: deposit.expiresAt
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // BE15 - Confirmar depósito on-chain
  static async confirmDeposit(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { depositId } = req.params;
      const { 
        txHash, 
        blockNumber, 
        confirmations, 
        gasUsed, 
        fee 
      } = req.body;

      const deposit = await Deposit.findOne({ depositId });
      if (!deposit) {
        return res.status(404).json({
          status: 'error',
          message: 'Depósito não encontrado'
        });
      }

      // Verificar se depósito pode ser confirmado
      if (!['pending', 'confirming'].includes(deposit.status)) {
        return res.status(400).json({
          status: 'error',
          message: 'Depósito não pode ser confirmado no status atual'
        });
      }

      // Atualizar dados da blockchain
      if (deposit.status === 'pending') {
        deposit.markAsConfirming(txHash, blockNumber, deposit.blockchainData.fromAddress);
      } else {
        deposit.updateConfirmations(confirmations, gasUsed, fee);
      }

      await deposit.save();

      // Se foi confirmado, atualizar saldo da carteira
      if (deposit.status === 'confirmed') {
        const wallet = await MultisigWallet.findById(deposit.walletId);
        wallet.balance.usdc += deposit.amount;
        wallet.balance.lastUpdated = new Date();
        await wallet.save();

        // BE16 - Emitir evento de confirmação
        try {
          // Emitir evento WebSocket/SSE para o frontend
          console.log(`✅ Depósito ${deposit.depositId} confirmado`);
          
          // Notificar membros da carteira
          await NotificationService.notifyWalletMembers(
            deposit.walletId,
            'deposit_confirmed',
            {
              transactionData: {
                depositId: deposit.depositId,
                amount: deposit.amount,
                currency: deposit.currency,
                txHash: deposit.blockchainData.txHash
              }
            }
          );
        } catch (eventError) {
          console.error('Erro ao emitir evento:', eventError);
        }
      }

      res.json({
        status: 'success',
        message: deposit.status === 'confirmed' ? 
          'Depósito confirmado com sucesso' : 
          'Confirmações atualizadas',
        data: {
          depositId: deposit.depositId,
          status: deposit.status,
          confirmationProgress: deposit.confirmationProgress,
          confirmedAt: deposit.confirmedAt,
          blockchainData: deposit.blockchainData
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Listar depósitos de uma carteira
  static async getWalletDeposits(req, res, next) {
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

      // Verificar se a carteira existe e se o usuário tem acesso
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

      const [deposits, total] = await Promise.all([
        Deposit.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        Deposit.countDocuments(query)
      ]);

      res.json({
        status: 'success',
        data: {
          deposits: deposits.map(deposit => ({
            depositId: deposit.depositId,
            amount: deposit.formattedAmount,
            status: deposit.status,
            fromAddress: deposit.blockchainData.fromAddress,
            txHash: deposit.blockchainData.txHash,
            confirmationProgress: deposit.confirmationProgress,
            memo: deposit.metadata.memo,
            createdAt: deposit.createdAt,
            confirmedAt: deposit.confirmedAt
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

  // Obter detalhes de um depósito específico
  static async getDepositDetails(req, res, next) {
    try {
      const { depositId } = req.params;
      const userId = req.user.id;

      const deposit = await Deposit.findOne({ depositId });
      if (!deposit) {
        return res.status(404).json({
          status: 'error',
          message: 'Depósito não encontrado'
        });
      }

      // Verificar se o usuário tem acesso à carteira
      const wallet = await MultisigWallet.findById(deposit.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado'
        });
      }

      res.json({
        status: 'success',
        data: {
          depositId: deposit.depositId,
          walletId: deposit.walletId,
          walletName: deposit.walletId.name,
          amount: deposit.formattedAmount,
          status: deposit.status,
          initiatedBy: {
            id: deposit.initiatedBy._id,
            name: deposit.initiatedBy.name,
            email: deposit.initiatedBy.email
          },
          blockchainData: deposit.blockchainData,
          confirmationProgress: deposit.confirmationProgress,
          metadata: deposit.metadata,
          createdAt: deposit.createdAt,
          confirmedAt: deposit.confirmedAt,
          expiresAt: deposit.expiresAt
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Cancelar depósito pendente
  static async cancelDeposit(req, res, next) {
    try {
      const { depositId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const deposit = await Deposit.findOne({ depositId });
      if (!deposit) {
        return res.status(404).json({
          status: 'error',
          message: 'Depósito não encontrado'
        });
      }

      // Verificar se o usuário é o que iniciou o depósito ou admin da carteira
      const wallet = await MultisigWallet.findById(deposit.walletId);
      const canCancel = deposit.initiatedBy._id.toString() === userId.toString() || 
                       wallet.isAdmin(userId);

      if (!canCancel) {
        return res.status(403).json({
          status: 'error',
          message: 'Apenas o usuário que iniciou o depósito ou administradores podem cancelá-lo'
        });
      }

      // Verificar se pode ser cancelado
      if (!deposit.canBeCancelled()) {
        return res.status(400).json({
          status: 'error',
          message: 'Depósito não pode ser cancelado no status atual'
        });
      }

      // Cancelar depósito
      deposit.cancel(reason);
      await deposit.save();

      res.json({
        status: 'success',
        message: 'Depósito cancelado com sucesso',
        data: {
          depositId: deposit.depositId,
          status: deposit.status,
          cancelledAt: deposit.updatedAt
        }
      });

    } catch (error) {
      if (error.message.includes('não pode ser cancelado')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  // Obter estatísticas de depósitos da carteira
  static async getWalletDepositStats(req, res, next) {
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
      const stats = await Deposit.getWalletStats(walletId, parseInt(period));

      // Calcular totais
      const totalDeposits = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);
      const totalAmount = Object.values(stats).reduce((sum, stat) => sum + stat.totalAmount, 0);

      res.json({
        status: 'success',
        data: {
          period: parseInt(period),
          summary: {
            totalDeposits,
            totalAmount: `${totalAmount.toFixed(6)} USDC`,
            averageAmount: totalDeposits > 0 ? `${(totalAmount / totalDeposits).toFixed(6)} USDC` : '0.000000 USDC'
          },
          byStatus: stats
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Buscar depósitos pendentes de confirmação (para processamento em background)
  static async getPendingConfirmations(req, res, next) {
    try {
      // Este endpoint seria usado por um job/worker para processar confirmações
      const pendingDeposits = await Deposit.findPendingConfirmation();

      res.json({
        status: 'success',
        data: {
          count: pendingDeposits.length,
          deposits: pendingDeposits.map(deposit => ({
            depositId: deposit.depositId,
            walletId: deposit.walletId,
            txHash: deposit.blockchainData.txHash,
            confirmations: deposit.blockchainData.confirmations,
            requiredConfirmations: deposit.blockchainData.requiredConfirmations
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Buscar depósitos pendentes de confirmação
  static async getPendingDeposits(req, res, next) {
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
          message: 'Apenas participantes da carteira podem visualizar depósitos'
        });
      }

      // Buscar depósitos pendentes
      const pendingDeposits = await Deposit.find({
        walletId: walletId,
        status: 'pending'
      }).sort({ createdAt: -1 });

      res.status(200).json({
        status: 'success',
        data: {
          deposits: pendingDeposits,
          count: pendingDeposits.length
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Retentar processamento de depósito
  static async retryDeposit(req, res, next) {
    try {
      res.status(200).json({
        status: 'success',
        message: 'Método retryDeposit implementado'
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = DepositController;