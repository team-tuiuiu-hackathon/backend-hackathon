const axios = require('axios');
const StellarValidation = require('../models/stellarValidationModel');

/**
 * Serviço para validação de endereços Stellar usando a API Horizon
 * Agora com cache em banco de dados PostgreSQL para otimização
 */
class StellarValidationService {
  constructor() {
    // URL da API Horizon do Stellar (mainnet)
    this.horizonUrl = 'https://horizon.stellar.org';
    // URL da API Horizon do Stellar (testnet) - para fallback
    this.horizonTestnetUrl = 'https://horizon-testnet.stellar.org';
  }

  /**
   * Valida se um endereço Stellar existe na rede
   * @param {string} address - Endereço Stellar para validar
   * @param {boolean} forceRefresh - Força nova validação ignorando cache
   * @returns {Promise<{isValid: boolean, exists: boolean, accountData?: object, error?: string}>}
   */
  async validateStellarAddress(address, forceRefresh = false) {
    try {
      // Validação básica do formato do endereço Stellar
      if (!this.isValidStellarFormat(address)) {
        return {
          isValid: false,
          exists: false,
          error: 'Formato de endereço Stellar inválido'
        };
      }

      // Verifica cache no banco de dados (se não forçar refresh)
      if (!forceRefresh) {
        const cachedValidation = await StellarValidation.findByAddress(address);
        if (cachedValidation && !cachedValidation.isExpired()) {
          console.log(`Usando validação em cache para ${address}`);
          return {
            isValid: cachedValidation.isValid,
            exists: cachedValidation.exists,
            accountData: cachedValidation.accountData,
            error: cachedValidation.errorMessage,
            fromCache: true
          };
        }
      }

      // Tenta buscar a conta na mainnet primeiro
      let accountData = await this.fetchAccountData(address, this.horizonUrl);
      let network = null;
      
      // Se não encontrar na mainnet, tenta na testnet
      if (!accountData) {
        accountData = await this.fetchAccountData(address, this.horizonTestnetUrl);
        if (accountData) {
          network = 'testnet';
        }
      } else {
        network = 'mainnet';
      }

      const validationResult = {
        isValid: true,
        exists: !!accountData,
        accountData: accountData ? {
          id: accountData.id,
          sequence: accountData.sequence,
          balances: accountData.balances,
          flags: accountData.flags,
          thresholds: accountData.thresholds
        } : null,
        network: network,
        error: accountData ? null : 'Endereço Stellar válido mas conta não encontrada na rede'
      };

      // Salva resultado no cache do banco
      await StellarValidation.createOrUpdate({
        address: address,
        isValid: validationResult.isValid,
        exists: validationResult.exists,
        accountData: validationResult.accountData,
        network: network,
        errorMessage: validationResult.error
      });

      return validationResult;

    } catch (error) {
      console.error('Erro na validação do endereço Stellar:', error.message);
      
      // Salva erro no cache
      try {
        await StellarValidation.createOrUpdate({
          address: address,
          isValid: false,
          exists: false,
          accountData: null,
          network: null,
          errorMessage: `Erro na validação: ${error.message}`
        });
      } catch (cacheError) {
        console.error('Erro ao salvar no cache:', cacheError.message);
      }

      return {
        isValid: false,
        exists: false,
        error: `Erro na validação: ${error.message}`
      };
    }
  }

  /**
   * Busca dados da conta na API Horizon
   * @param {string} address - Endereço da conta
   * @param {string} horizonUrl - URL da API Horizon
   * @returns {Promise<object|null>}
   */
  async fetchAccountData(address, horizonUrl) {
    try {
      const response = await axios.get(`${horizonUrl}/accounts/${address}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Conta não encontrada é um caso normal
        return null;
      }
      throw error;
    }
  }

  /**
   * Valida o formato básico de um endereço Stellar
   * @param {string} address - Endereço para validar
   * @returns {boolean}
   */
  isValidStellarFormat(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Endereços Stellar começam com 'G' e têm 56 caracteres
    if (!address.startsWith('G') || address.length !== 56) {
      return false;
    }

    // Verifica se contém apenas caracteres válidos (Base32)
    const base32Pattern = /^[A-Z2-7]+$/;
    return base32Pattern.test(address);
  }

  /**
   * Valida múltiplos endereços Stellar em lote
   * @param {string[]} addresses - Array de endereços para validar
   * @param {boolean} forceRefresh - Força nova validação ignorando cache
   * @returns {Promise<object[]>}
   */
  async validateMultipleStellarAddresses(addresses, forceRefresh = false) {
    const results = [];
    
    for (const address of addresses) {
      const result = await this.validateStellarAddress(address, forceRefresh);
      results.push({
        address,
        ...result
      });
    }

    return results;
  }

  /**
   * Limpa cache de validações antigas
   * @returns {Promise<number>} Número de registros removidos
   */
  async cleanupCache() {
    try {
      return await StellarValidation.cleanupOldValidations();
    } catch (error) {
      console.error('Erro ao limpar cache:', error.message);
      return 0;
    }
  }

  /**
   * Obtém estatísticas do cache
   * @returns {Promise<object>} Estatísticas do cache
   */
  async getCacheStatistics() {
    try {
      const { Op } = require('sequelize');
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const [total, valid, existing, recent] = await Promise.all([
        StellarValidation.count(),
        StellarValidation.count({ where: { isValid: true } }),
        StellarValidation.count({ where: { exists: true } }),
        StellarValidation.count({ 
          where: { 
            lastValidated: { [Op.gte]: oneHourAgo } 
          } 
        })
      ]);

      return {
        totalValidations: total,
        validAddresses: valid,
        existingAccounts: existing,
        recentValidations: recent,
        cacheHitRate: total > 0 ? ((recent / total) * 100).toFixed(2) + '%' : '0%'
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error.message);
      return {
        totalValidations: 0,
        validAddresses: 0,
        existingAccounts: 0,
        recentValidations: 0,
        cacheHitRate: '0%'
      };
    }
  }

  /**
   * Remove uma validação específica do cache
   * @param {string} address - Endereço para remover do cache
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  async removeCachedValidation(address) {
    try {
      const deleted = await StellarValidation.destroy({
        where: { address }
      });
      return deleted > 0;
    } catch (error) {
      console.error('Erro ao remover validação do cache:', error.message);
      return false;
    }
  }
}

module.exports = new StellarValidationService();