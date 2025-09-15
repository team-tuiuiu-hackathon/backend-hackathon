const Wallet = require('../models/walletModel');
const { validationResult } = require('express-validator');

/**
 * Controller para gerenciar operações de smart contract
 */
class SmartContractController {
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
        message: 'Carteiras recuperadas com sucesso',
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