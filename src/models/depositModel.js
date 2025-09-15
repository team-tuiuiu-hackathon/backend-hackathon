const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  // Identificador único do depósito
  depositId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Carteira de destino
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultisigWallet',
    required: true,
    index: true
  },

  // Usuário que iniciou o depósito
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Valor do depósito
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Valor mínimo de depósito é 0.01 USDC'],
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

  // Status do depósito
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirming', 'confirmed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Dados da blockchain
  blockchainData: {
    // Hash da transação na blockchain
    txHash: {
      type: String,
      sparse: true,
      index: true
    },
    
    // Endereço de origem
    fromAddress: {
      type: String,
      required: true
    },
    
    // Endereço de destino (contrato da carteira)
    toAddress: {
      type: String,
      required: true
    },
    
    // Número do bloco
    blockNumber: {
      type: Number,
      sparse: true
    },
    
    // Número de confirmações
    confirmations: {
      type: Number,
      default: 0
    },
    
    // Confirmações necessárias
    requiredConfirmations: {
      type: Number,
      default: 12 // Padrão para Stellar/Soroban
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
    }
  },

  // Metadados adicionais
  metadata: {
    // Descrição/memo do depósito
    memo: {
      type: String,
      maxlength: 500
    },
    
    // IP do usuário (para auditoria)
    userIP: {
      type: String
    },
    
    // User agent
    userAgent: {
      type: String
    },
    
    // Tentativas de confirmação
    confirmationAttempts: {
      type: Number,
      default: 0
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  confirmedAt: {
    type: Date,
    sparse: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Expiração (depósitos pendentes expiram após 24h)
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    },
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  collection: 'deposits'
});

// Índices compostos para consultas eficientes
depositSchema.index({ walletId: 1, status: 1 });
depositSchema.index({ walletId: 1, createdAt: -1 });
depositSchema.index({ initiatedBy: 1, createdAt: -1 });
depositSchema.index({ status: 1, createdAt: -1 });
depositSchema.index({ 'blockchainData.txHash': 1 }, { sparse: true });

// Virtual para valor formatado
depositSchema.virtual('formattedAmount').get(function() {
  return `${this.amount.toFixed(6)} ${this.currency}`;
});

// Virtual para verificar se está confirmado
depositSchema.virtual('isConfirmed').get(function() {
  return this.status === 'confirmed';
});

// Virtual para verificar se está pendente
depositSchema.virtual('isPending').get(function() {
  return ['pending', 'confirming'].includes(this.status);
});

// Virtual para progresso de confirmações
depositSchema.virtual('confirmationProgress').get(function() {
  if (!this.blockchainData.confirmations || !this.blockchainData.requiredConfirmations) {
    return null;
  }
  
  return {
    current: this.blockchainData.confirmations,
    required: this.blockchainData.requiredConfirmations,
    percentage: Math.min(100, (this.blockchainData.confirmations / this.blockchainData.requiredConfirmations) * 100)
  };
});

// Métodos de instância

// Marcar como confirmando (quando detectado na blockchain)
depositSchema.methods.markAsConfirming = function(txHash, blockNumber, fromAddress) {
  this.status = 'confirming';
  this.blockchainData.txHash = txHash;
  this.blockchainData.blockNumber = blockNumber;
  this.blockchainData.fromAddress = fromAddress;
  this.blockchainData.confirmations = 1;
  this.metadata.confirmationAttempts += 1;
  this.updatedAt = new Date();
};

// Atualizar confirmações
depositSchema.methods.updateConfirmations = function(confirmations, gasUsed, fee) {
  this.blockchainData.confirmations = confirmations;
  
  if (gasUsed) this.blockchainData.gasUsed = gasUsed;
  if (fee) this.blockchainData.fee = fee;
  
  // Se atingiu confirmações necessárias, marcar como confirmado
  if (confirmations >= this.blockchainData.requiredConfirmations) {
    this.status = 'confirmed';
    this.confirmedAt = new Date();
  }
  
  this.updatedAt = new Date();
};

// Marcar como confirmado
depositSchema.methods.markAsConfirmed = function() {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  this.updatedAt = new Date();
};

// Marcar como falhou
depositSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.metadata.failureReason = reason;
  this.updatedAt = new Date();
};

// Cancelar depósito
depositSchema.methods.cancel = function(reason) {
  if (!['pending', 'confirming'].includes(this.status)) {
    throw new Error('Apenas depósitos pendentes ou confirmando podem ser cancelados');
  }
  
  this.status = 'cancelled';
  this.metadata.cancellationReason = reason;
  this.updatedAt = new Date();
};

// Verificar se pode ser cancelado
depositSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirming'].includes(this.status) && 
         this.blockchainData.confirmations < this.blockchainData.requiredConfirmations;
};

// Middleware pre-save
depositSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para popular referências automaticamente
depositSchema.pre(/^find/, function(next) {
  this.populate('walletId', 'name contractAddress')
      .populate('initiatedBy', 'name email');
  next();
});

// Métodos estáticos

// Buscar depósitos por carteira
depositSchema.statics.findByWallet = function(walletId, options = {}) {
  const query = this.find({ walletId });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  return query.sort({ createdAt: -1 });
};

// Buscar depósitos pendentes de confirmação
depositSchema.statics.findPendingConfirmation = function() {
  return this.find({
    status: 'confirming',
    'blockchainData.confirmations': { 
      $lt: this.schema.path('blockchainData.requiredConfirmations').default() 
    }
  });
};

// Buscar depósitos expirados
depositSchema.statics.findExpired = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
};

// Estatísticas de depósitos por carteira
depositSchema.statics.getWalletStats = async function(walletId, period = 30) {
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

module.exports = mongoose.model('Deposit', depositSchema);