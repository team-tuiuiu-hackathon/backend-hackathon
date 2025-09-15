const { validationResult } = require('express-validator');
const FundSplitService = require('../services/fundSplitService');
const FundSplitRule = require('../models/fundSplitRuleModel');
const MultisigWallet = require('../models/multisigWalletModel');

/**
 * Controlador para gerenciamento de regras de divisão automática de fundos
 */
class FundSplitController {
  constructor() {
    this.fundSplitService = new FundSplitService();
  }

  /**
   * Cria uma nova regra de divisão
   * @route POST /api/fund-split/rules
   */
  async createRule(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const ruleData = req.body;

      // Validar dados específicos baseados no tipo de regra
      const validationError = this.validateRuleData(ruleData);
      if (validationError) {
        return res.status(400).json({
          status: 'error',
          message: validationError
        });
      }

      const rule = await this.fundSplitService.createSplitRule(ruleData, userId);

      res.status(201).json({
        status: 'success',
        message: 'Regra de divisão criada com sucesso',
        data: {
          rule: {
            ruleId: rule.ruleId,
            name: rule.name,
            ruleType: rule.ruleType,
            status: rule.status,
            priority: rule.priority,
            createdAt: rule.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Erro ao criar regra de divisão:', error);
      
      if (error.message.includes('não encontrada') || error.message.includes('não tem permissão')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao criar regra'
      });
    }
  }

  /**
   * Lista regras de divisão de uma carteira
   * @route GET /api/fund-split/wallets/:walletId/rules
   */
  async listRules(req, res) {
    try {
      const { walletId } = req.params;
      const { status, ruleType, page = 1, limit = 10 } = req.query;

      // Verificar se o usuário tem acesso à carteira
      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({
          status: 'error',
          message: 'Carteira não encontrada'
        });
      }

      const userMember = wallet.members.find(member => 
        member.userId.toString() === req.user.id
      );

      if (!userMember) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuário não tem acesso a esta carteira'
        });
      }

      const filters = {};
      if (status) filters.status = status;
      if (ruleType) filters.ruleType = ruleType;

      const rules = await this.fundSplitService.listSplitRules(walletId, filters);

      // Paginação
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRules = rules.slice(startIndex, endIndex);

      res.json({
        status: 'success',
        data: {
          rules: paginatedRules.map(rule => ({
            ruleId: rule.ruleId,
            name: rule.name,
            description: rule.description,
            ruleType: rule.ruleType,
            status: rule.status,
            priority: rule.priority,
            totalExecutions: rule.totalExecutions,
            successRate: rule.successRate,
            lastExecutedAt: rule.lastExecutedAt,
            createdAt: rule.createdAt,
            createdBy: rule.createdBy
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(rules.length / limit),
            totalItems: rules.length,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Erro ao listar regras de divisão:', error);
      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao listar regras'
      });
    }
  }

  /**
   * Obtém detalhes de uma regra específica
   * @route GET /api/fund-split/rules/:ruleId
   */
  async getRule(req, res) {
    try {
      const { ruleId } = req.params;

      const rule = await FundSplitRule.findOne({ ruleId })
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email')
        .populate('walletId', 'name address');

      if (!rule) {
        return res.status(404).json({
          status: 'error',
          message: 'Regra não encontrada'
        });
      }

      // Verificar se o usuário tem acesso à carteira
      const wallet = await MultisigWallet.findById(rule.walletId);
      const userMember = wallet.members.find(member => 
        member.userId.toString() === req.user.id
      );

      if (!userMember) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuário não tem acesso a esta regra'
        });
      }

      res.json({
        status: 'success',
        data: {
          rule: {
            ruleId: rule.ruleId,
            name: rule.name,
            description: rule.description,
            ruleType: rule.ruleType,
            status: rule.status,
            priority: rule.priority,
            conditions: rule.conditions,
            splitConfiguration: rule.splitConfiguration,
            advancedSettings: rule.advancedSettings,
            totalExecutions: rule.totalExecutions,
            successRate: rule.successRate,
            lastExecutedAt: rule.lastExecutedAt,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt,
            createdBy: rule.createdBy,
            lastModifiedBy: rule.lastModifiedBy,
            wallet: rule.walletId
          }
        }
      });

    } catch (error) {
      console.error('Erro ao obter regra de divisão:', error);
      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao obter regra'
      });
    }
  }

  /**
   * Atualiza uma regra de divisão
   * @route PUT /api/fund-split/rules/:ruleId
   */
  async updateRule(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { ruleId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      // Validar dados específicos baseados no tipo de regra
      if (updateData.ruleType || updateData.splitConfiguration) {
        const validationError = this.validateRuleData(updateData);
        if (validationError) {
          return res.status(400).json({
            status: 'error',
            message: validationError
          });
        }
      }

      const rule = await this.fundSplitService.updateSplitRule(ruleId, updateData, userId);

      res.json({
        status: 'success',
        message: 'Regra de divisão atualizada com sucesso',
        data: {
          rule: {
            ruleId: rule.ruleId,
            name: rule.name,
            ruleType: rule.ruleType,
            status: rule.status,
            priority: rule.priority,
            updatedAt: rule.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Erro ao atualizar regra de divisão:', error);
      
      if (error.message.includes('não encontrada') || error.message.includes('não tem permissão')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao atualizar regra'
      });
    }
  }

  /**
   * Remove uma regra de divisão
   * @route DELETE /api/fund-split/rules/:ruleId
   */
  async deleteRule(req, res) {
    try {
      const { ruleId } = req.params;
      const userId = req.user.id;

      await this.fundSplitService.deleteSplitRule(ruleId, userId);

      res.json({
        status: 'success',
        message: 'Regra de divisão removida com sucesso'
      });

    } catch (error) {
      console.error('Erro ao remover regra de divisão:', error);
      
      if (error.message.includes('não encontrada') || error.message.includes('não tem permissão')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao remover regra'
      });
    }
  }

  /**
   * Obtém estatísticas de uma regra
   * @route GET /api/fund-split/rules/:ruleId/statistics
   */
  async getRuleStatistics(req, res) {
    try {
      const { ruleId } = req.params;

      // Verificar se a regra existe e o usuário tem acesso
      const rule = await FundSplitRule.findOne({ ruleId }).populate('walletId');
      if (!rule) {
        return res.status(404).json({
          status: 'error',
          message: 'Regra não encontrada'
        });
      }

      const wallet = await MultisigWallet.findById(rule.walletId);
      const userMember = wallet.members.find(member => 
        member.userId.toString() === req.user.id
      );

      if (!userMember) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuário não tem acesso a esta regra'
        });
      }

      const statistics = await this.fundSplitService.getRuleStatistics(ruleId);

      res.json({
        status: 'success',
        data: {
          statistics
        }
      });

    } catch (error) {
      console.error('Erro ao obter estatísticas da regra:', error);
      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao obter estatísticas'
      });
    }
  }

  /**
   * Simula execução de uma regra
   * @route POST /api/fund-split/rules/:ruleId/simulate
   */
  async simulateRule(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados de entrada inválidos',
          errors: errors.array()
        });
      }

      const { ruleId } = req.params;
      const { amount } = req.body;

      // Verificar se a regra existe e o usuário tem acesso
      const rule = await FundSplitRule.findOne({ ruleId }).populate('walletId');
      if (!rule) {
        return res.status(404).json({
          status: 'error',
          message: 'Regra não encontrada'
        });
      }

      const wallet = await MultisigWallet.findById(rule.walletId);
      const userMember = wallet.members.find(member => 
        member.userId.toString() === req.user.id
      );

      if (!userMember) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuário não tem acesso a esta regra'
        });
      }

      const simulation = await this.fundSplitService.simulateRuleExecution(ruleId, amount);

      res.json({
        status: 'success',
        message: 'Simulação executada com sucesso',
        data: {
          simulation
        }
      });

    } catch (error) {
      console.error('Erro na simulação da regra:', error);
      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor na simulação'
      });
    }
  }

  /**
   * Ativa ou desativa uma regra
   * @route PATCH /api/fund-split/rules/:ruleId/status
   */
  async toggleRuleStatus(req, res) {
    try {
      const { ruleId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: 'Status deve ser: active, inactive ou suspended'
        });
      }

      const rule = await this.fundSplitService.updateSplitRule(
        ruleId, 
        { status }, 
        userId
      );

      res.json({
        status: 'success',
        message: `Regra ${status === 'active' ? 'ativada' : 'desativada'} com sucesso`,
        data: {
          rule: {
            ruleId: rule.ruleId,
            name: rule.name,
            status: rule.status,
            updatedAt: rule.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Erro ao alterar status da regra:', error);
      
      if (error.message.includes('não encontrada') || error.message.includes('não tem permissão')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao alterar status'
      });
    }
  }

  /**
   * Obtém histórico de execuções de uma regra
   * @route GET /api/fund-split/rules/:ruleId/executions
   */
  async getRuleExecutions(req, res) {
    try {
      const { ruleId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Verificar se a regra existe e o usuário tem acesso
      const rule = await FundSplitRule.findOne({ ruleId }).populate('walletId');
      if (!rule) {
        return res.status(404).json({
          status: 'error',
          message: 'Regra não encontrada'
        });
      }

      const wallet = await MultisigWallet.findById(rule.walletId);
      const userMember = wallet.members.find(member => 
        member.userId.toString() === req.user.id
      );

      if (!userMember) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuário não tem acesso a esta regra'
        });
      }

      // Paginação do histórico
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const executions = rule.executionHistory
        .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
        .slice(startIndex, endIndex);

      res.json({
        status: 'success',
        data: {
          executions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(rule.executionHistory.length / limit),
            totalItems: rule.executionHistory.length,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Erro ao obter histórico de execuções:', error);
      res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor ao obter histórico'
      });
    }
  }

  /**
   * Valida dados de uma regra baseado no tipo
   * @param {Object} ruleData - Dados da regra
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  validateRuleData(ruleData) {
    const { ruleType, splitConfiguration } = ruleData;

    if (!splitConfiguration) {
      return null; // Validação será feita no modelo
    }

    switch (ruleType) {
      case 'percentage':
        if (!splitConfiguration.percentageRules || splitConfiguration.percentageRules.length === 0) {
          return 'Regras de percentual são obrigatórias para tipo percentage';
        }

        const totalPercentage = splitConfiguration.percentageRules.reduce(
          (sum, rule) => sum + (rule.percentage || 0), 0
        );

        if (totalPercentage > 100) {
          return 'A soma dos percentuais não pode exceder 100%';
        }

        for (const rule of splitConfiguration.percentageRules) {
          if (!rule.destinationAddress || !rule.percentage) {
            return 'Endereço de destino e percentual são obrigatórios';
          }

          if (rule.percentage <= 0 || rule.percentage > 100) {
            return 'Percentual deve estar entre 0.01 e 100';
          }
        }
        break;

      case 'fixed_amount':
        if (!splitConfiguration.fixedAmountRules || splitConfiguration.fixedAmountRules.length === 0) {
          return 'Regras de valor fixo são obrigatórias para tipo fixed_amount';
        }

        for (const rule of splitConfiguration.fixedAmountRules) {
          if (!rule.destinationAddress || !rule.amount) {
            return 'Endereço de destino e valor são obrigatórios';
          }

          if (rule.amount <= 0) {
            return 'Valor deve ser maior que zero';
          }
        }
        break;

      case 'priority_based':
        if (!splitConfiguration.priorityRules || splitConfiguration.priorityRules.length === 0) {
          return 'Regras de prioridade são obrigatórias para tipo priority_based';
        }

        for (const rule of splitConfiguration.priorityRules) {
          if (!rule.destinationAddress || !rule.priority || !rule.allocation || !rule.allocationType) {
            return 'Endereço, prioridade, alocação e tipo de alocação são obrigatórios';
          }

          if (rule.priority <= 0) {
            return 'Prioridade deve ser maior que zero';
          }

          if (rule.allocation <= 0) {
            return 'Alocação deve ser maior que zero';
          }

          if (rule.allocationType === 'percentage' && rule.allocation > 100) {
            return 'Alocação percentual não pode exceder 100%';
          }
        }
        break;
    }

    return null;
  }
}

module.exports = FundSplitController;