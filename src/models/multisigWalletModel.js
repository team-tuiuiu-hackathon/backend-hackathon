const mongoose = require('mongoose');

const multisigWalletSchema = new mongoose.Schema({
  // Identificação da carteira
  walletId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Nome da carteira
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Descrição opcional
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Endereço do contrato no Soroban
  contractAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Threshold de assinaturas necessárias
  threshold: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: function(value) {
        return value <= this.participants.length;
      },
      message: 'Threshold não pode ser maior que o número de participantes'
    }
  },
  
  // Lista de participantes
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    publicKey: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'participant'],
      default: 'participant'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Configurações de divisão automática
  divisionRules: [{
    ruleId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed_amount'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status da carteira
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Saldo atual (cache do blockchain)
  balance: {
    usdc: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Metadados do blockchain
  blockchainData: {
    creationTxHash: String,
    lastSyncBlock: Number,
    lastSyncAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Criador da carteira
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compostos para performance
multisigWalletSchema.index({ 'participants.userId': 1, status: 1 });
multisigWalletSchema.index({ createdBy: 1, status: 1 });
multisigWalletSchema.index({ contractAddress: 1, status: 1 });

// Virtual para contar participantes
multisigWalletSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual para verificar se threshold é válido
multisigWalletSchema.virtual('isThresholdValid').get(function() {
  return this.threshold > 0 && this.threshold <= this.participants.length;
});

// Método para verificar se usuário é participante
multisigWalletSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.userId.toString() === userId.toString());
};

// Método para verificar se usuário é admin
multisigWalletSchema.methods.isAdmin = function(userId) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  return participant && participant.role === 'admin';
};

// Método para adicionar participante
multisigWalletSchema.methods.addParticipant = function(userId, publicKey, role = 'participant', addedBy) {
  if (this.isParticipant(userId)) {
    throw new Error('Usuário já é participante desta carteira');
  }
  
  this.participants.push({
    userId,
    publicKey,
    role,
    addedBy,
    addedAt: new Date()
  });
  
  return this;
};

// Método para remover participante
multisigWalletSchema.methods.removeParticipant = function(userId) {
  const initialLength = this.participants.length;
  this.participants = this.participants.filter(p => p.userId.toString() !== userId.toString());
  
  if (this.participants.length === initialLength) {
    throw new Error('Usuário não encontrado na carteira');
  }
  
  // Verificar se threshold ainda é válido
  if (this.threshold > this.participants.length) {
    throw new Error('Não é possível remover participante: threshold ficaria inválido');
  }
  
  return this;
};

// Middleware para validar threshold antes de salvar
multisigWalletSchema.pre('save', function(next) {
  if (this.threshold > this.participants.length) {
    return next(new Error('Threshold não pode ser maior que o número de participantes'));
  }
  
  if (this.threshold < 1) {
    return next(new Error('Threshold deve ser pelo menos 1'));
  }
  
  next();
});

// Middleware para popular referências automaticamente
multisigWalletSchema.pre(/^find/, function(next) {
  this.populate('participants.userId', 'name email publicKey')
      .populate('createdBy', 'name email')
      .populate('divisionRules.recipient', 'name email');
  next();
});

module.exports = mongoose.model('MultisigWallet', multisigWalletSchema);