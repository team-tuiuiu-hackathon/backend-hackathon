const FundSplitRule = require('../models/fundSplitRuleModel');
const MultisigWallet = require('../models/multisigWalletModel');
const Transaction = require('../models/transactionModel');
const SorobanService = require('./sorobanService');
const NotificationService = require('./notificationService');

/**
 * Serviço para processamento de regras de divisão automática de fundos
 */
class FundSplitService {
  constructor() {
    this.sorobanService = new SorobanService();
    this.notificationService = new NotificationService();
  }

  /**
   * Processa divisão automática de fundos para uma transação
   * @param {Object} transactionData - Dados da transação
   * @param {string} walletId - ID da carteira
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processFundSplit(transactionData, walletId) {
    try {
      console.log(`Iniciando processamento de divisão de fundos para carteira ${walletId}`);

      // Buscar regras ativas para a carteira
      const activeRules = await FundSplitRule.findActiveRulesByWallet(walletId);
      
      if (activeRules.length === 0) {
        console.log('Nenhuma regra de divisão ativa encontrada');
        return {
          success: true,
          message: 'Nenhuma regra de divisão aplicável',
          rulesProcessed: 0,
          totalSplitAmount: 0
        };
      }

      console.log(`Encontradas ${activeRules.length} regras ativas`);

      // Verificar saldo da carteira
      const wallet = await MultisigWallet.findById(walletId);
      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      const results = [];
      let totalProcessed = 0;

      // Processar cada regra em ordem de prioridade
      for (const rule of activeRules) {
        try {
          // Verificar se a regra deve ser executada
          if (!rule.shouldExecute(transactionData)) {
            console.log(`Regra ${rule.name} não atende às condições`);
            continue;
          }

          // Verificar saldo disponível
          const availableBalance = wallet.balance - totalProcessed;
          if (availableBalance <= 0) {
            console.log('Saldo insuficiente para continuar processamento');
            break;
          }

          // Calcular divisões
          const splitResult = rule.calculateSplits(Math.min(transactionData.amount, availableBalance));
          
          if (splitResult.splits.length === 0) {
            console.log(`Nenhuma divisão calculada para regra ${rule.name}`);
            continue;
          }

          // Executar divisões
          const executionResult = await this.executeSplits(
            rule,
            splitResult.splits,
            wallet,
            transactionData
          );

          results.push({
            ruleId: rule.ruleId,
            ruleName: rule.name,
            ...executionResult
          });

          totalProcessed += splitResult.totalSplitAmount;

          // Registrar execução na regra
          await rule.recordExecution({
            triggerTransactionId: transactionData.transactionId,
            totalAmount: splitResult.totalSplitAmount,
            splits: executionResult.splits,
            status: executionResult.success ? 'success' : 'failed',
            errorMessage: executionResult.error
          });

        } catch (error) {
          console.error(`Erro ao processar regra ${rule.name}:`, error);
          results.push({
            ruleId: rule.ruleId,
            ruleName: rule.name,
            success: false,
            error: error.message
          });
        }
      }

      // Atualizar saldo da carteira
      if (totalProcessed > 0) {
        wallet.balance -= totalProcessed;
        await wallet.save();
      }

      // Enviar notificações
      await this.sendSplitNotifications(wallet, results, totalProcessed);

      return {
        success: true,
        message: 'Processamento de divisão concluído',
        rulesProcessed: results.length,
        totalSplitAmount: totalProcessed,
        results
      };

    } catch (error) {
      console.error('Erro no processamento de divisão de fundos:', error);
      throw error;
    }
  }

  /**
   * Executa as divisões calculadas por uma regra
   * @param {Object} rule - Regra de divisão
   * @param {Array} splits - Divisões calculadas
   * @param {Object} wallet - Carteira de origem
   * @param {Object} transactionData - Dados da transação original
   * @returns {Promise<Object>} Resultado da execução
   */
  async executeSplits(rule, splits, wallet, transactionData) {
    const executedSplits = [];
    let successCount = 0;
    let totalAmount = 0;

    for (const split of splits) {
      try {
        // Criar transação para a divisão
        const splitTransaction = new Transaction({
          walletId: wallet._id,
          type: 'fund_split',
          amount: split.amount,
          recipient: split.destinationAddress,
          description: `Divisão automática: ${split.description || rule.name}`,
          status: 'pending',
          metadata: {
            originalTransactionId: transactionData.transactionId,
            splitRuleId: rule.ruleId,
            splitRuleName: rule.name
          }
        });

        await splitTransaction.save();

        // Executar transação via Soroban
        const sorobanResult = await this.sorobanService.executePayment({
          fromAddress: wallet.address,
          toAddress: split.destinationAddress,
          amount: split.amount,
          transactionId: splitTransaction.transactionId
        });

        if (sorobanResult.success) {
          splitTransaction.status = 'completed';
          splitTransaction.transactionHash = sorobanResult.transactionHash;
          splitTransaction.completedAt = new Date();
          await splitTransaction.save();

          executedSplits.push({
            destinationAddress: split.destinationAddress,
            amount: split.amount,
            percentage: split.percentage,
            status: 'success',
            transactionHash: sorobanResult.transactionHash,
            transactionId: splitTransaction.transactionId
          });

          successCount++;
          totalAmount += split.amount;
        } else {
          splitTransaction.status = 'failed';
          splitTransaction.failureReason = sorobanResult.error;
          await splitTransaction.save();

          executedSplits.push({
            destinationAddress: split.destinationAddress,
            amount: split.amount,
            percentage: split.percentage,
            status: 'failed',
            error: sorobanResult.error,
            transactionId: splitTransaction.transactionId
          });
        }

      } catch (error) {
        console.error(`Erro ao executar divisão para ${split.destinationAddress}:`, error);
        executedSplits.push({
          destinationAddress: split.destinationAddress,
          amount: split.amount,
          percentage: split.percentage,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      success: successCount > 0,
      totalSplits: splits.length,
      successfulSplits: successCount,
      totalAmount,
      splits: executedSplits,
      error: successCount === 0 ? 'Nenhuma divisão foi executada com sucesso' : null
    };
  }

  /**
   * Cria uma nova regra de divisão
   * @param {Object} ruleData - Dados da regra
   * @param {string} userId - ID do usuário criador
   * @returns {Promise<Object>} Regra criada
   */
  async createSplitRule(ruleData, userId) {
    try {
      // Validar carteira
      const wallet = await MultisigWallet.findById(ruleData.walletId);
      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      // Verificar se o usuário tem permissão na carteira
      const userMember = wallet.members.find(member => 
        member.userId.toString() === userId && member.role === 'admin'
      );

      if (!userMember) {
        throw new Error('Usuário não tem permissão para criar regras nesta carteira');
      }

      // Criar regra
      const rule = new FundSplitRule({
        ...ruleData,
        createdBy: userId
      });

      await rule.save();

      console.log(`Regra de divisão criada: ${rule.name} (${rule.ruleId})`);

      // Notificar membros da carteira
      await this.notificationService.notifyWalletMembers(
        wallet._id,
        'fund_split_rule_created',
        {
          ruleName: rule.name,
          ruleType: rule.ruleType,
          createdBy: userId
        }
      );

      return rule;

    } catch (error) {
      console.error('Erro ao criar regra de divisão:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma regra de divisão existente
   * @param {string} ruleId - ID da regra
   * @param {Object} updateData - Dados para atualização
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Regra atualizada
   */
  async updateSplitRule(ruleId, updateData, userId) {
    try {
      const rule = await FundSplitRule.findOne({ ruleId });
      if (!rule) {
        throw new Error('Regra não encontrada');
      }

      // Verificar permissões
      const wallet = await MultisigWallet.findById(rule.walletId);
      const userMember = wallet.members.find(member => 
        member.userId.toString() === userId && member.role === 'admin'
      );

      if (!userMember) {
        throw new Error('Usuário não tem permissão para modificar esta regra');
      }

      // Atualizar regra
      Object.assign(rule, updateData);
      rule.lastModifiedBy = userId;
      await rule.save();

      console.log(`Regra de divisão atualizada: ${rule.name} (${rule.ruleId})`);

      // Notificar membros da carteira
      await this.notificationService.notifyWalletMembers(
        wallet._id,
        'fund_split_rule_updated',
        {
          ruleName: rule.name,
          ruleType: rule.ruleType,
          modifiedBy: userId
        }
      );

      return rule;

    } catch (error) {
      console.error('Erro ao atualizar regra de divisão:', error);
      throw error;
    }
  }

  /**
   * Remove uma regra de divisão
   * @param {string} ruleId - ID da regra
   * @param {string} userId - ID do usuário
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async deleteSplitRule(ruleId, userId) {
    try {
      const rule = await FundSplitRule.findOne({ ruleId });
      if (!rule) {
        throw new Error('Regra não encontrada');
      }

      // Verificar permissões
      const wallet = await MultisigWallet.findById(rule.walletId);
      const userMember = wallet.members.find(member => 
        member.userId.toString() === userId && member.role === 'admin'
      );

      if (!userMember) {
        throw new Error('Usuário não tem permissão para remover esta regra');
      }

      await FundSplitRule.deleteOne({ ruleId });

      console.log(`Regra de divisão removida: ${rule.name} (${rule.ruleId})`);

      // Notificar membros da carteira
      await this.notificationService.notifyWalletMembers(
        wallet._id,
        'fund_split_rule_deleted',
        {
          ruleName: rule.name,
          ruleType: rule.ruleType,
          deletedBy: userId
        }
      );

      return true;

    } catch (error) {
      console.error('Erro ao remover regra de divisão:', error);
      throw error;
    }
  }

  /**
   * Lista regras de divisão de uma carteira
   * @param {string} walletId - ID da carteira
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Array>} Lista de regras
   */
  async listSplitRules(walletId, filters = {}) {
    try {
      const query = { walletId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.ruleType) {
        query.ruleType = filters.ruleType;
      }

      const rules = await FundSplitRule.find(query)
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email')
        .sort({ priority: 1, createdAt: -1 });

      return rules;

    } catch (error) {
      console.error('Erro ao listar regras de divisão:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de uma regra de divisão
   * @param {string} ruleId - ID da regra
   * @returns {Promise<Object>} Estatísticas da regra
   */
  async getRuleStatistics(ruleId) {
    try {
      const rule = await FundSplitRule.findOne({ ruleId });
      if (!rule) {
        throw new Error('Regra não encontrada');
      }

      const stats = {
        totalExecutions: rule.totalExecutions,
        successRate: rule.successRate,
        totalAmountProcessed: rule.executionHistory.reduce(
          (sum, exec) => sum + exec.totalAmount, 0
        ),
        lastExecution: rule.lastExecution,
        averageAmountPerExecution: rule.totalExecutions > 0 
          ? rule.executionHistory.reduce((sum, exec) => sum + exec.totalAmount, 0) / rule.totalExecutions
          : 0,
        executionsByStatus: {
          success: rule.executionHistory.filter(exec => exec.status === 'success').length,
          partial_success: rule.executionHistory.filter(exec => exec.status === 'partial_success').length,
          failed: rule.executionHistory.filter(exec => exec.status === 'failed').length
        }
      };

      return stats;

    } catch (error) {
      console.error('Erro ao obter estatísticas da regra:', error);
      throw error;
    }
  }

  /**
   * Envia notificações sobre divisões executadas
   * @param {Object} wallet - Carteira
   * @param {Array} results - Resultados das divisões
   * @param {number} totalAmount - Valor total dividido
   */
  async sendSplitNotifications(wallet, results, totalAmount) {
    try {
      if (results.length === 0) return;

      const successfulRules = results.filter(r => r.success);
      const failedRules = results.filter(r => !r.success);

      // Notificar sobre divisões bem-sucedidas
      if (successfulRules.length > 0) {
        await this.notificationService.notifyWalletMembers(
          wallet._id,
          'fund_split_executed',
          {
            walletName: wallet.name,
            rulesExecuted: successfulRules.length,
            totalAmount,
            timestamp: new Date()
          }
        );
      }

      // Notificar sobre falhas
      if (failedRules.length > 0) {
        await this.notificationService.notifyWalletMembers(
          wallet._id,
          'fund_split_failed',
          {
            walletName: wallet.name,
            failedRules: failedRules.length,
            errors: failedRules.map(r => r.error),
            timestamp: new Date()
          }
        );
      }

    } catch (error) {
      console.error('Erro ao enviar notificações de divisão:', error);
      // Não propagar erro de notificação
    }
  }

  /**
   * Simula execução de uma regra sem executar
   * @param {string} ruleId - ID da regra
   * @param {number} amount - Valor para simular
   * @returns {Promise<Object>} Resultado da simulação
   */
  async simulateRuleExecution(ruleId, amount) {
    try {
      const rule = await FundSplitRule.findOne({ ruleId });
      if (!rule) {
        throw new Error('Regra não encontrada');
      }

      const splitResult = rule.calculateSplits(amount);

      return {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        inputAmount: amount,
        splits: splitResult.splits,
        totalSplitAmount: splitResult.totalSplitAmount,
        remainingAmount: splitResult.remainingAmount,
        wouldExecute: rule.shouldExecute({ amount, type: 'simulation' })
      };

    } catch (error) {
      console.error('Erro na simulação da regra:', error);
      throw error;
    }
  }
}

module.exports = FundSplitService;