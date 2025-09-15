const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Identificador único do pagamento
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Carteira de origem
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultisigWallet',
    required: true,
    index: true
  },

  // Usuário que propôs o pagamento
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Dados do destinatário
  recipient: {
    // Endereço da carteira de destino
    address: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          // Validação básica para endereço Stellar
          return /^G[A-Z0-9]{55}$/.test(v);
        },
        message: 'Endereço Stellar inválido'
      }
    },
    
    // Nome/identificação do destinatário (opcional)
    name: {
      type: String,
      maxlength: 100
    },
    
    // Email do destinatário (opcional)
    email: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email inválido'
      }
    }
  },

  // Valor do pagamento
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Valor mínimo de pagamento é 0.01 USDC'],
    validate: {
      validator: function(value) {
        // Validar até 6 casas decimais (padrão USDC)
        return Number.isInteger(value * 1000000);
      },
      message: 'Valor deve ter no máximo 6 casas decimais'
    }
  },

  // Moeda (sempre USDC para este sistema)
  currency: {
    type: String,
    required: true,
    enum: ['USDC'],
    default: 'USDC'
  },

  // Status do pagamento
  status: {
    type: String,
    required: true,
    enum: ['proposed', 'approved', 'executing', 'completed', 'failed', 'rejected', 'cancelled'],
    default: 'proposed',
    index: true
  },

  // Assinaturas necessárias para aprovação
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
    publicKey: {
      type: String,
      required: true
    },
    signedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Dados da blockchain
  blockchainData: {
    // Hash da transação na blockchain
    txHash: {
      type: String,
      sparse: true,
      index: true
    },
    
    // Número do bloco
    blockNumber: {
      type: Number,
      sparse: true
    },
    
    // Gas usado
    gasUsed: {
      type: Number,
      sparse: true
    },
    
    // Taxa paga
    fee: {
      type: Number,
      sparse: true
    },
    
    // Número de confirmações
    confirmations: {
      type: Number,
      default: 0
    }
  },

  // Metadados do pagamento
  metadata: {
    // Descrição/memo do pagamento
    memo: {
      type: String,
      maxlength: 500
    },
    
    // Categoria do pagamento
    category: {
      type: String,
      enum: ['salary', 'expense', 'refund', 'dividend', 'other'],
      default: 'other'
    },
    
    // Referência externa (número da fatura, etc.)
    externalReference: {
      type: String,
      maxlength: 100
    },
    
    // IP do usuário que propôs
    userIP: {
      type: String
    },
    
    // User agent
    userAgent: {
      type: String
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  approvedAt: {
    type: Date,
    sparse: true
  },
  
  executedAt: {
    type: Date,
    sparse: true
  },
  
  completedAt: {
    type: Date,
    sparse: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Dados de rejeição/cancelamento
  rejection: {
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    reason: {
      type: String,
      maxlength: 500
    },
    rejectedAt: {
      type: Date,
      sparse: true
    }
  },

  // Expiração (pagamentos propostos expiram após 7 dias)
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    },
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  collection: 'payments'
});

// Índices compostos para consultas eficientes
paymentSchema.index({ walletId: 1, status: 1 });
paymentSchema.index({ walletId: 1, createdAt: -1 });
paymentSchema.index({ proposedBy: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ 'recipient.address': 1 });
paymentSchema.index({ 'blockchainData.txHash': 1 }, { sparse: true });

// Virtual para valor formatado
paymentSchema.virtual('formattedAmount').get(function() {
  return `${this.amount.toFixed(6)} ${this.currency}`;
});

// Virtual para verificar se está aprovado
paymentSchema.virtual('isApproved').get(function() {
  return ['approved', 'executing', 'completed'].includes(this.status);
});

// Virtual para verificar se está pendente
paymentSchema.virtual('isPending').get(function() {
  return this.status === 'proposed';
});

// Virtual para progresso de assinaturas
paymentSchema.virtual('signatureProgress').get(function() {
  if (!this.populated('walletId') || !this.walletId.threshold) {
    return null;
  }
  
  return {
    current: this.signatures.length,
    required: this.walletId.threshold,
    percentage: (this.signatures.length / this.walletId.threshold) * 100
  };
});

// Virtual para verificar se tem assinaturas suficientes
paymentSchema.virtual('hasEnoughSignatures').get(function() {
  if (!this.populated('walletId') || !this.walletId.threshold) {
    return false;
  }
  
  return this.signatures.length >= this.walletId.threshold;
});

// Métodos de instância

// Adicionar assinatura
paymentSchema.methods.addSignature = function(userId, signature, publicKey) {
  // Verificar se usuário já assinou
  const existingSignature = this.signatures.find(
    sig => sig.userId.toString() === userId.toString()
  );
  
  if (existingSignature) {
    throw new Error('Usuário já assinou este pagamento');
  }
  
  // Verificar se pagamento ainda está proposto
  if (this.status !== 'proposed') {
    throw new Error('Apenas pagamentos propostos podem ser assinados');
  }
  
  // Adicionar assinatura
  this.signatures.push({
    userId,
    signature,
    publicKey,
    signedAt: new Date()
  });
  
  // Verificar se atingiu threshold
  if (this.hasEnoughSignatures) {
    this.status = 'approved';
    this.approvedAt = new Date();
  }
  
  this.updatedAt = new Date();
};

// Verificar se usuário já assinou
paymentSchema.methods.hasUserSigned = function(userId) {
  return this.signatures.some(
    sig => sig.userId.toString() === userId.toString()
  );
};

// Marcar como executando
paymentSchema.methods.markAsExecuting = function() {
  if (this.status !== 'approved') {
    throw new Error('Apenas pagamentos aprovados podem ser executados');
  }
  
  this.status = 'executing';
  this.executedAt = new Date();
  this.updatedAt = new Date();
};

// Marcar como completado
paymentSchema.methods.markAsCompleted = function(txHash, blockNumber, gasUsed, fee) {
  if (this.status !== 'executing') {
    throw new Error('Apenas pagamentos em execução podem ser marcados como completados');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.blockchainData.txHash = txHash;
  this.blockchainData.blockNumber = blockNumber;
  this.blockchainData.gasUsed = gasUsed;
  this.blockchainData.fee = fee;
  this.updatedAt = new Date();
};

// Marcar como falhou
paymentSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.metadata.failureReason = reason;
  this.updatedAt = new Date();
};

// Rejeitar pagamento
paymentSchema.methods.reject = function(userId, reason) {
  if (!['proposed', 'approved'].includes(this.status)) {
    throw new Error('Apenas pagamentos propostos ou aprovados podem ser rejeitados');
  }
  
  this.status = 'rejected';
  this.rejection = {
    rejectedBy: userId,
    reason: reason,
    rejectedAt: new Date()
  };
  this.updatedAt = new Date();
};

// Cancelar pagamento
paymentSchema.methods.cancel = function(reason) {
  if (!['proposed', 'approved'].includes(this.status)) {
    throw new Error('Apenas pagamentos propostos ou aprovados podem ser cancelados');
  }
  
  this.status = 'cancelled';
  this.metadata.cancellationReason = reason;
  this.updatedAt = new Date();
};

// Middleware pre-save
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para popular referências automaticamente
paymentSchema.pre(/^find/, function(next) {
  this.populate('walletId', 'name threshold contractAddress')
      .populate('proposedBy', 'name email')
      .populate('signatures.userId', 'name email')
      .populate('rejection.rejectedBy', 'name email');
  next();
});

// Métodos estáticos

// Buscar pagamentos por carteira
paymentSchema.statics.findByWallet = function(walletId, options = {}) {
  const query = this.find({ walletId });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  return query.sort({ createdAt: -1 });
};

// Buscar pagamentos pendentes de assinatura
paymentSchema.statics.findPendingSignature = function(walletId) {
  return this.find({
    walletId,
    status: 'proposed'
  }).sort({ createdAt: -1 });
};

// Buscar pagamentos aprovados para execução
paymentSchema.statics.findReadyForExecution = function(walletId) {
  return this.find({
    walletId,
    status: 'approved'
  }).sort({ approvedAt: 1 });
};

// Estatísticas de pagamentos por carteira
paymentSchema.statics.getWalletStats = async function(walletId, period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  const stats = await this.aggregate([
    {
      $match: {
        walletId: new mongoose.Types.ObjectId(walletId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      totalAmount: stat.totalAmount
    };
    return acc;
  }, {});
};

// Buscar pagamentos por destinatário
paymentSchema.statics.findByRecipient = function(address, options = {}) {
  const query = this.find({ 'recipient.address': address });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  return query.sort({ createdAt: -1 });
};

module.exports = mongoose.model('Payment', paymentSchema);