const { DataTypes } = require('sequelize');

const getSequelize = () => {
  try {
    const { sequelize } = require('../config/database');
    return sequelize;
  } catch (error) {
    console.warn('Erro ao conectar com o banco de dados:', error.message);
    return null;
  }
};

const sequelize = getSequelize();

// Se não conseguir conectar com o banco, retorna um modelo mock
if (!sequelize) {
  console.warn('Usando modelo Transaction mock devido à falha na conexão com o banco');
  module.exports = {
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findByPk: () => Promise.resolve(null),
    update: () => Promise.resolve([1]),
    destroy: () => Promise.resolve(1),
    findAll: () => Promise.resolve([])
  };
  return;
}

/**
 * Modelo de Transação para PostgreSQL usando Sequelize
 */
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  walletId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'multisig_wallets',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: {
        args: [['payment', 'deposit', 'division', 'configuration']],
        msg: 'Tipo deve ser payment, deposit, division ou configuration'
      }
    }
  },
  amount: {
    type: DataTypes.DECIMAL(20, 7),
    allowNull: true,
    validate: {
      min: {
        args: [0],
        msg: 'Valor deve ser positivo'
      }
    }
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USDC',
    allowNull: true,
    validate: {
      isIn: {
        args: [['USDC', 'XLM']],
        msg: 'Moeda deve ser USDC ou XLM'
      }
    }
  },
  recipient: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  sender: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: {
        args: [['pending', 'approved', 'executed', 'rejected', 'expired']],
        msg: 'Status deve ser pending, approved, executed, rejected ou expired'
      }
    }
  },
  signatures: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  },
  requiredSignatures: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  blockchainData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: true
  },
  proposedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  proposedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  executedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  auditLog: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['type']
    },
    {
      fields: ['proposedBy']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Métodos de instância para sistema de aprovação avançado
Transaction.prototype.addSignature = function(userId, signature, publicKey) {
  const signatures = this.signatures || [];
  
  // Verificar se o usuário já assinou
  const existingSignature = signatures.find(sig => sig.userId === userId);
  if (existingSignature) {
    throw new Error('Usuário já assinou esta transação');
  }
  
  // Adicionar nova assinatura
  signatures.push({
    userId,
    signature,
    publicKey,
    signedAt: new Date(),
    ipAddress: null // Pode ser preenchido pelo controller
  });
  
  this.signatures = signatures;
  
  // Adicionar ao log de auditoria
  const auditLog = this.auditLog || [];
  auditLog.push({
    action: 'signature_added',
    userId,
    timestamp: new Date(),
    details: { signatureCount: signatures.length }
  });
  this.auditLog = auditLog;
  
  return this.save();
};

Transaction.prototype.removeSignature = function(userId, removedBy) {
  const signatures = this.signatures || [];
  const initialCount = signatures.length;
  
  this.signatures = signatures.filter(sig => sig.userId !== userId);
  
  if (this.signatures.length === initialCount) {
    throw new Error('Assinatura não encontrada');
  }
  
  // Adicionar ao log de auditoria
  const auditLog = this.auditLog || [];
  auditLog.push({
    action: 'signature_removed',
    userId: removedBy,
    timestamp: new Date(),
    details: { 
      removedSignatureUserId: userId,
      signatureCount: this.signatures.length 
    }
  });
  this.auditLog = auditLog;
  
  return this.save();
};

Transaction.prototype.isFullyApproved = function() {
  const signatureCount = (this.signatures || []).length;
  return signatureCount >= this.requiredSignatures;
};

Transaction.prototype.canUserSign = async function(userId) {
  // Verificar se o usuário já assinou
  const signatures = this.signatures || [];
  const hasAlreadySigned = signatures.some(sig => sig.userId === userId);
  
  if (hasAlreadySigned) {
    return { canSign: false, reason: 'Usuário já assinou esta transação' };
  }
  
  // Verificar se a transação ainda está pendente
  if (this.status !== 'pending') {
    return { canSign: false, reason: 'Transação não está mais pendente' };
  }
  
  // Verificar se não expirou
  if (this.expiresAt && new Date() > this.expiresAt) {
    return { canSign: false, reason: 'Transação expirou' };
  }
  
  // Verificar se o usuário é participante da carteira
  const MultisigWallet = require('./multisigWalletModel');
  const wallet = await MultisigWallet.findByPk(this.walletId);
  
  if (!wallet) {
    return { canSign: false, reason: 'Carteira não encontrada' };
  }
  
  const participants = wallet.participants || [];
  const isParticipant = participants.some(p => p.userId === userId);
  
  if (!isParticipant) {
    return { canSign: false, reason: 'Usuário não é participante da carteira' };
  }
  
  return { canSign: true };
};

Transaction.prototype.approve = function(approvedBy) {
  if (this.status !== 'pending') {
    throw new Error('Transação não pode ser aprovada no status atual');
  }
  
  if (!this.isFullyApproved()) {
    throw new Error('Transação não possui assinaturas suficientes');
  }
  
  this.status = 'approved';
  this.approvedAt = new Date();
  
  // Adicionar ao log de auditoria
  const auditLog = this.auditLog || [];
  auditLog.push({
    action: 'transaction_approved',
    userId: approvedBy,
    timestamp: new Date(),
    details: { 
      signatureCount: (this.signatures || []).length,
      requiredSignatures: this.requiredSignatures
    }
  });
  this.auditLog = auditLog;
  
  return this.save();
};

Transaction.prototype.reject = function(rejectedBy, reason) {
  if (this.status !== 'pending') {
    throw new Error('Transação não pode ser rejeitada no status atual');
  }
  
  this.status = 'rejected';
  
  // Adicionar ao log de auditoria
  const auditLog = this.auditLog || [];
  auditLog.push({
    action: 'transaction_rejected',
    userId: rejectedBy,
    timestamp: new Date(),
    details: { reason }
  });
  this.auditLog = auditLog;
  
  return this.save();
};

Transaction.prototype.execute = function(executedBy, blockchainResult) {
  if (this.status !== 'approved') {
    throw new Error('Transação deve estar aprovada para ser executada');
  }
  
  this.status = 'executed';
  this.executedAt = new Date();
  this.blockchainData = {
    ...this.blockchainData,
    ...blockchainResult
  };
  
  // Adicionar ao log de auditoria
  const auditLog = this.auditLog || [];
  auditLog.push({
    action: 'transaction_executed',
    userId: executedBy,
    timestamp: new Date(),
    details: { 
      transactionHash: blockchainResult?.transactionHash,
      blockNumber: blockchainResult?.blockNumber
    }
  });
  this.auditLog = auditLog;
  
  return this.save();
};

module.exports = Transaction;