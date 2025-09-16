const Wallet = require('../models/walletModel');
const SorobanService = require('../services/sorobanService');
const MultisigWallet = require('../models/multisigWalletModel');
const Transaction = require('../models/transactionModel');
const Deposit = require('../models/depositModel');
const Payment = require('../models/paymentModel');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * Controller para gerenciar operações de smart contract
 */
class SmartContractController {
  constructor() {
    this.sorobanService = new SorobanService();
  }

  // Inicializar conexão com Soroban
  async initializeSoroban(req, res, next) {
    try {
      const result = await this.sorobanService.initializeContract();
      
      res.json({
        status: 'success',
        message: 'Conexão com Soroban inicializada com sucesso',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Sincronizar carteira com o contrato Soroban
  async syncWalletWithContract(req, res, next) {
    try {
      const { walletId } = req.params;
      const userId = req.user.id;

      const wallet = await MultisigWallet.findByPk(walletId);
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
          message: 'Acesso negado'
        });
      }

      // Criar carteira no contrato se ainda não existe
      if (!wallet.contractAddress) {
        const contractResult = await this.sorobanService.createMultisigWallet({
          owners: wallet.participants.map(p => ({ publicKey: p.publicKey })),
          threshold: wallet.threshold,
          name: wallet.name
        });

        wallet.contractAddress = contractResult.contractAddress;
        wallet.contractTxHash = contractResult.txHash;
        await wallet.save();
      }

      // Sincronizar saldo
      const contractBalance = await this.sorobanService.getWalletBalance(walletId);
      
      res.json({
        status: 'success',
        message: 'Carteira sincronizada com sucesso',
        data: {
          walletId: wallet._id,
          contractAddress: wallet.contractAddress,
          localBalance: wallet.balance.usdc,
          contractBalance: contractBalance,
          synced: Math.abs(wallet.balance.usdc - contractBalance) < 0.000001
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Processar transação no contrato
  async processContractTransaction(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { action } = req.body; // 'propose', 'sign', 'execute'
      const userId = req.user.id;

      const transaction = await Transaction.findOne({ transactionId });
      if (!transaction) {
        return res.status(404).json({
          status: 'error',
          message: 'Transação não encontrada'
        });
      }

      const wallet = await MultisigWallet.findById(transaction.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado'
        });
      }

      let result;

      switch (action) {
        case 'propose':
          result = await this.sorobanService.proposeTransaction({
            walletId: transaction.walletId,
            to: transaction.to,
            amount: transaction.amount,
            memo: transaction.memo,
            proposer: { secretKey: req.user.secretKey }
          });
          
          transaction.contractTxHash = result.txHash;
          await transaction.save();
          break;

        case 'sign':
          result = await this.sorobanService.signTransaction({
            transactionId: transaction.transactionId,
            signature: req.body.signature,
            signer: { secretKey: req.user.secretKey }
          });
          break;

        case 'execute':
          result = await this.sorobanService.executeTransaction({
            transactionId: transaction.transactionId,
            executor: { secretKey: req.user.secretKey }
          });
          
          transaction.status = 'completed';
          transaction.executedAt = new Date();
          transaction.blockchainData = {
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed
          };
          await transaction.save();
          break;

        default:
          return res.status(400).json({
            status: 'error',
            message: 'Ação inválida'
          });
      }

      res.json({
        status: 'success',
        message: `Transação ${action} processada com sucesso`,
        data: result
      });

    } catch (error) {
      next(error);
    }
  }

  // Processar depósito no contrato
  async processContractDeposit(req, res, next) {
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

      const wallet = await MultisigWallet.findById(deposit.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado'
        });
      }

      const result = await this.sorobanService.processDeposit({
        walletId: deposit.walletId,
        amount: deposit.amount,
        fromAddress: deposit.fromAddress,
        txHash: deposit.txHash
      });

      deposit.status = 'confirmed';
      deposit.confirmedAt = new Date();
      deposit.blockchainData = {
        blockNumber: result.blockNumber,
        confirmations: result.confirmations,
        contractTxHash: result.txHash
      };
      await deposit.save();

      // Atualizar saldo da carteira
      wallet.balance.usdc += deposit.amount;
      wallet.balance.lastUpdated = new Date();
      await wallet.save();

      res.json({
        status: 'success',
        message: 'Depósito processado no contrato com sucesso',
        data: {
          depositId: deposit.depositId,
          contractTxHash: result.txHash,
          newBalance: wallet.balance.usdc
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Processar pagamento no contrato
  async processContractPayment(req, res, next) {
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

      const wallet = await MultisigWallet.findById(payment.walletId);
      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado'
        });
      }

      if (payment.status !== 'approved') {
        return res.status(400).json({
          status: 'error',
          message: 'Pagamento não está aprovado'
        });
      }

      const result = await this.sorobanService.processPayment({
        walletId: payment.walletId,
        recipientAddress: payment.recipient.address,
        amount: payment.amount,
        memo: payment.metadata.memo
      });

      payment.status = 'completed';
      payment.completedAt = new Date();
      payment.blockchainData = {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };
      await payment.save();

      // Atualizar saldo da carteira
      wallet.balance.usdc -= payment.amount;
      wallet.balance.lastUpdated = new Date();
      await wallet.save();

      res.json({
        status: 'success',
        message: 'Pagamento processado no contrato com sucesso',
        data: {
          paymentId: payment.paymentId,
          txHash: result.txHash,
          newBalance: wallet.balance.usdc
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Obter status da rede Soroban
  async getNetworkStatus(req, res, next) {
    try {
      const status = await this.sorobanService.getNetworkStatus();
      
      res.json({
        status: 'success',
        data: status.network
      });
    } catch (error) {
      next(error);
    }
  }

  // Obter detalhes de transação da blockchain
  async getTransactionDetails(req, res, next) {
    try {
      const { txHash } = req.params;
      
      const details = await this.sorobanService.getTransactionDetails(txHash);
      
      res.json({
        status: 'success',
        data: details.transaction
      });
    } catch (error) {
      next(error);
    }
  }

  // Verificar saldo no contrato
  async getContractBalance(req, res, next) {
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

      if (!wallet.isParticipant(userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado'
        });
      }

      const contractBalance = await this.sorobanService.getWalletBalance(walletId);
      
      res.json({
        status: 'success',
        data: {
          walletId: walletId,
          contractBalance: `${contractBalance.toFixed(6)} USDC`,
          localBalance: `${wallet.balance.usdc.toFixed(6)} USDC`,
          synced: Math.abs(wallet.balance.usdc - contractBalance) < 0.000001
        }
      });

    } catch (error) {
      next(error);
    }
  }
  /**
   * Conecta uma carteira ao smart contract
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async connectWallet(req, res, next) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { address, metadata = {} } = req.body;

      // Verificar se a carteira já existe
      const existingWallet = await SmartContractController.findWalletByAddress(address);
      if (existingWallet) {
        return res.status(409).json({
          success: false,
          message: 'Carteira já está registrada',
          data: existingWallet.toJSON()
        });
      }

      // Criar nova carteira
      const wallet = new Wallet({ address });
      
      // Adicionar metadados se fornecidos
      Object.keys(metadata).forEach(key => {
        wallet.addMetadata(key, metadata[key]);
      });

      // Simular conexão com smart contract
      await SmartContractController.simulateSmartContractConnection(wallet);
      
      // Armazenar carteira (em produção, seria salva no banco de dados)
      await SmartContractController.saveWallet(wallet);

      res.status(201).json({
        success: true,
        message: 'Carteira conectada com sucesso',
        data: wallet.toJSON()
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Desconecta uma carteira do smart contract
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async disconnectWallet(req, res, next) {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        return res.status(400).json({
          success: false,
          message: 'ID da carteira é obrigatório'
        });
      }

      const wallet = await SmartContractController.findWalletById(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      // Atualizar status para desconectado
      wallet.updateConnectionStatus('disconnected');
      await SmartContractController.saveWallet(wallet);

      res.json({
        success: true,
        message: 'Carteira desconectada com sucesso',
        data: wallet.toJSON()
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todas as carteiras conectadas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async listWallets(req, res, next) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      const wallets = await SmartContractController.getAllWallets({
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        message: 'Wallets retrieved successfully',
        data: wallets.map(wallet => wallet.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtém informações de uma carteira específica
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async getWallet(req, res, next) {
    try {
      const { walletId } = req.params;

      const wallet = await SmartContractController.findWalletById(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Carteira encontrada',
        data: wallet.toJSON()
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Executa uma transação no smart contract
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async executeTransaction(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { walletId, contractMethod, parameters = [] } = req.body;

      const wallet = await SmartContractController.findWalletById(walletId);
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Carteira não encontrada'
        });
      }

      if (!wallet.isConnected()) {
        return res.status(400).json({
          success: false,
          message: 'Carteira não está conectada'
        });
      }

      // Simular execução de transação
      const transactionResult = await SmartContractController.simulateTransaction({
        wallet,
        method: contractMethod,
        parameters
      });

      res.json({
        success: true,
        message: 'Transação executada com sucesso',
        data: transactionResult
      });

    } catch (error) {
      next(error);
    }
  }

  // Métodos auxiliares (em produção, seriam integrados com banco de dados real)
  
  /**
   * Simula conexão com smart contract
   * @param {Wallet} wallet - Instância da carteira
   */
  static async simulateSmartContractConnection(wallet) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simular possível falha de conexão (5% de chance)
    if (Math.random() < 0.05) {
      wallet.updateConnectionStatus('error');
      throw new Error('Falha na conexão com o smart contract');
    }
    
    wallet.updateConnectionStatus('connected');
  }

  /**
   * Simula execução de transação
   * @param {Object} params - Parâmetros da transação
   */
  static async simulateTransaction({ wallet, method, parameters }) {
    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: Math.floor(Math.random() * 100000),
      status: 'success',
      method,
      parameters,
      timestamp: new Date()
    };
  }

  static async getContractStatus(req, res, next) {
    try {
      res.json({
        status: 'success',
        message: 'Status do contrato obtido com sucesso',
        data: {
          network: 'testnet',
          status: 'connected',
          contractAddress: 'MOCK_CONTRACT_ADDRESS',
          lastSync: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Métodos de persistência simulados (substituir por implementação real do banco)
  static walletStorage = new Map();

  static async saveWallet(wallet) {
    SmartContractController.walletStorage.set(wallet.id, wallet);
    return wallet;
  }

  static async findWalletById(id) {
    return SmartContractController.walletStorage.get(id) || null;
  }

  static async findWalletByAddress(address) {
    for (const wallet of SmartContractController.walletStorage.values()) {
      if (wallet.address === address) {
        return wallet;
      }
    }
    return null;
  }

  static async getAllWallets({ status, page = 1, limit = 10 }) {
    let wallets = Array.from(SmartContractController.walletStorage.values());
    
    if (status) {
      wallets = wallets.filter(wallet => wallet.connectionStatus === status);
    }
    
    const startIndex = (page - 1) * limit;
    return wallets.slice(startIndex, startIndex + limit);
  }
}

module.exports = SmartContractController;