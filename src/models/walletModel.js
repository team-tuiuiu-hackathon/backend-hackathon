const { v4: uuidv4 } = require('uuid');

/**
 * Modelo para representar carteiras que serão conectadas ao smart contract
 * @class Wallet
 */
class Wallet {
  /**
   * Cria uma nova instância de Wallet
   * @param {Object} walletData - Dados da carteira
   * @param {string} walletData.address - Endereço da carteira
   * @param {string} [walletData.id] - Identificador único (gerado automaticamente se não fornecido)
   * @param {Date} [walletData.createdAt] - Data de criação (gerada automaticamente se não fornecida)
   * @param {string} [walletData.connectionStatus] - Status de conexão (padrão: 'disconnected')
   */
  constructor({ address, id = null, createdAt = null, connectionStatus = 'disconnected' }) {
    this.validateAddress(address);
    
    this.id = id || uuidv4();
    this.address = address;
    this.createdAt = createdAt || new Date();
    this.connectionStatus = connectionStatus;
    this.lastConnectionAt = null;
    this.metadata = {};
  }

  /**
   * Valida o endereço da carteira
   * @param {string} address - Endereço a ser validado
   * @throws {Error} Se o endereço for inválido
   */
  validateAddress(address) {
    if (!address || typeof address !== 'string') {
      throw new Error('Endereço da carteira é obrigatório e deve ser uma string');
    }
    
    // Validação básica para endereços Ethereum (0x seguido de 40 caracteres hexadecimais)
    const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethereumAddressRegex.test(address)) {
      throw new Error('Formato de endereço de carteira inválido');
    }
  }

  /**
   * Atualiza o status de conexão da carteira
   * @param {string} status - Novo status ('connected', 'disconnected', 'connecting', 'error')
   * @throws {Error} Se o status for inválido
   */
  updateConnectionStatus(status) {
    const validStatuses = ['connected', 'disconnected', 'connecting', 'error'];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Status de conexão inválido. Valores aceitos: ${validStatuses.join(', ')}`);
    }
    
    this.connectionStatus = status;
    
    if (status === 'connected') {
      this.lastConnectionAt = new Date();
    }
  }

  /**
   * Adiciona metadados à carteira
   * @param {string} key - Chave do metadado
   * @param {any} value - Valor do metadado
   */
  addMetadata(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Chave do metadado deve ser uma string não vazia');
    }
    
    this.metadata[key] = value;
  }

  /**
   * Remove metadados da carteira
   * @param {string} key - Chave do metadado a ser removido
   */
  removeMetadata(key) {
    delete this.metadata[key];
  }

  /**
   * Verifica se a carteira está conectada
   * @returns {boolean} True se conectada, false caso contrário
   */
  isConnected() {
    return this.connectionStatus === 'connected';
  }

  /**
   * Converte a instância para objeto JSON
   * @returns {Object} Representação JSON da carteira
   */
  toJSON() {
    return {
      id: this.id,
      address: this.address,
      createdAt: this.createdAt,
      connectionStatus: this.connectionStatus,
      lastConnectionAt: this.lastConnectionAt,
      metadata: this.metadata
    };
  }

  /**
   * Cria uma instância de Wallet a partir de dados JSON
   * @param {Object} data - Dados JSON
   * @returns {Wallet} Nova instância de Wallet
   */
  static fromJSON(data) {
    const wallet = new Wallet({
      address: data.address,
      id: data.id,
      createdAt: data.createdAt ? new Date(data.createdAt) : null,
      connectionStatus: data.connectionStatus
    });
    
    wallet.lastConnectionAt = data.lastConnectionAt ? new Date(data.lastConnectionAt) : null;
    wallet.metadata = data.metadata || {};
    
    return wallet;
  }
}

module.exports = Wallet;