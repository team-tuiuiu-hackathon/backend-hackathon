const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Identificação da transação
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Carteira associada
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultisigWallet',
    required: true,
    index: true
  },
  
  // Tipo de transação
  type: {
    type: String,
    enum: ['payment', 'deposit', 'division', 'configuration'],
    required: true
  },
  
  // Dados da transação
  amount: {
    type: Number,
    required: function() {
      return ['payment', 'deposit', 'division'].includes(this.type);
    },
    min: 0
  },
  
  currency: {
    type: String,
    enum: ['USDC', 'XLM'],
    default: 'USDC'
  },
  
  // Destinatário (para pagamentos)
  recipient: {
    address: String,
    name: String
  },
  
  // Remetente (para depósitos)
  sender: {
    address: String,
    name: String
  },
  
  // Descrição da transação
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Dados específicos por tipo
  metadata: {
    // Para divisões automáticas
    divisionRuleId: String,
    divisionDetails: [{
      recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amount: Number,
      percentage: Number
    }],
    
    // Para configurações
    configurationChange: {
      type: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    },
    
    // Dados adicionais
    additionalData: mongoose.Schema.Types.Mixed
  },
  
  // Status da transação
  status: {
    type: String,
    enum: ['pending', 'approved', 'executed', 'rejected', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Assinaturas coletadas
  signatures: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    signature: {
      type: String,
      required: true
    },
    signedAt: {
      type: Date,
      default: Date.now
    },
    publicKey: String
  }],
  
  // Threshold necessário (snapshot no momento da criação)
  requiredSignatures: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Dados do blockchain
  blockchainData: {
    proposalTxHash: String,
    executionTxHash: String,
    blockNumber: Number,
    gasUsed: Number,
    contractEvents: [mongoose.Schema.Types.Mixed]
  },
  
  // Quem propôs a transação
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Timestamps importantes
  proposedAt: {
    type: Date,
    default: Date.now
  },
  
  approvedAt: Date,
  executedAt: Date,
  
  // Expiração da proposta
  expiresAt: {
    type: Date,
    default: function() {
      // Expira em 7 dias por padrão
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },
  
  // Logs de auditoria
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'signed', 'approved', 'executed', 'rejected', 'expired'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compostos para performance
transactionSchema.index({ walletId: 1, status: 1, createdAt: -1 });
transactionSchema.index({ proposedBy: 1, status: 1 });
transactionSchema.index({ 'signatures.userId': 1 });
transactionSchema.index({ expiresAt: 1 });
transactionSchema.index({ type: 1, status: 1 });

// Virtual para contar assinaturas
transactionSchema.virtual('signatureCount').get(function() {
  return this.signatures.length;
});

// Virtual para verificar se está aprovada
transactionSchema.virtual('isApproved').get(function() {
  return this.signatures.length >= this.requiredSignatures;
});

// Virtual para verificar se expirou
transactionSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt && this.status === 'pending';
});

// Virtual para progresso de assinaturas
transactionSchema.virtual('signatureProgress').get(function() {
  return {
    current: this.signatures.length,
    required: this.requiredSignatures,
    percentage: Math.round((this.signatures.length / this.requiredSignatures) * 100)
  };
});

// Método para verificar se usuário já assinou
transactionSchema.methods.hasUserSigned = function(userId) {
  return this.signatures.some(sig => sig.userId.toString() === userId.toString());
};

// Método para adicionar assinatura
transactionSchema.methods.addSignature = function(userId, signature, publicKey) {
  if (this.hasUserSigned(userId)) {
    throw new Error('Usuário já assinou esta transação');
  }
  
  if (this.status !== 'pending') {
    throw new Error('Não é possível assinar transação que não está pendente');
  }
  
  if (this.isExpired) {
    throw new Error('Transação expirada');
  }
  
  this.signatures.push({
    userId,
    signature,
    publicKey,
    signedAt: new Date()
  });
  
  // Adicionar ao log de auditoria
  this.auditLog.push({
    action: 'signed',
    userId,
    timestamp: new Date(),
    details: { signatureCount: this.signatures.length }
  });
  
  // Verificar se atingiu o threshold
  if (this.isApproved && this.status === 'pending') {
    this.status = 'approved';
    this.approvedAt = new Date();
    
    this.auditLog.push({
      action: 'approved',
      userId,
      timestamp: new Date(),
      details: { finalSignature: true }
    });
  }
  
  return this;
};

// Método para marcar como executada
transactionSchema.methods.markAsExecuted = function(txHash, blockNumber, gasUsed) {
  if (this.status !== 'approved') {
    throw new Error('Apenas transações aprovadas podem ser executadas');
  }
  
  this.status = 'executed';
  this.executedAt = new Date();
  this.blockchainData.executionTxHash = txHash;
  this.blockchainData.blockNumber = blockNumber;
  this.blockchainData.gasUsed = gasUsed;
  
  this.auditLog.push({
    action: 'executed',
    timestamp: new Date(),
    details: { txHash, blockNumber, gasUsed }
  });
  
  return this;
};

// Método para rejeitar transação
transactionSchema.methods.reject = function(userId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Apenas transações pendentes podem ser rejeitadas');
  }
  
  this.status = 'rejected';
  
  this.auditLog.push({
    action: 'rejected',
    userId,
    timestamp: new Date(),
    details: { reason }
  });
  
  return this;
};

// Middleware para verificar expiração
transactionSchema.pre('save', function(next) {
  if (this.isExpired && this.status === 'pending') {
    this.status = 'expired';
    this.auditLog.push({
      action: 'expired',
      timestamp: new Date(),
      details: { autoExpired: true }
    });
  }
  next();
});

// Middleware para popular referências
transactionSchema.pre(/^find/, function(next) {
  this.populate('walletId', 'name contractAddress')
      .populate('proposedBy', 'name email')
      .populate('signatures.userId', 'name email')
      .populate('metadata.divisionDetails.recipient', 'name email')
      .populate('auditLog.userId', 'name email');
  next();
});

// Método estático para limpar transações expiradas
transactionSchema.statics.expireOldTransactions = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: 'expired' },
      $push: {
        auditLog: {
          action: 'expired',
          timestamp: new Date(),
          details: { autoExpired: true, cleanupJob: true }
        }
      }
    }
  );
  
  return result;
};

module.exports = mongoose.model('Transaction', transactionSchema);