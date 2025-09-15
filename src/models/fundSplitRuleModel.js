const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Schema para regras de divisão automática de fundos
 */
const fundSplitRuleSchema = new mongoose.Schema({
  // Identificador único da regra
  ruleId: {
    type: String,
    default: uuidv4,
    unique: true,
    required: true,
    index: true
  },

  // Carteira à qual a regra se aplica
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultisigWallet',
    required: true,
    index: true
  },

  // Nome da regra para identificação
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Descrição da regra
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Tipo de regra de divisão
  ruleType: {
    type: String,
    enum: [
      'percentage', // Divisão por percentual
      'fixed_amount', // Valor fixo
      'priority_based', // Baseado em prioridade
      'conditional', // Condicional
      'threshold_based' // Baseado em limite
    ],
    required: true,
    index: true
  },

  // Status da regra
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },

  // Prioridade de execução (1 = mais alta)
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 100,
    index: true
  },

  // Condições para ativação da regra
  conditions: {
    // Valor mínimo para ativar a regra
    minAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    // Valor máximo para ativar a regra
    maxAmount: {
      type: Number,
      default: null
    },

    // Tipos de transação que ativam a regra
    transactionTypes: [{
      type: String,
      enum: ['deposit', 'payment', 'transfer', 'all'],
      default: 'all'
    }],

    // Horários de ativação
    timeConditions: {
      // Dias da semana (0 = domingo, 6 = sábado)
      daysOfWeek: [{
        type: Number,
        min: 0,
        max: 6
      }],

      // Horário de início (formato HH:MM)
      startTime: {
        type: String,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },

      // Horário de fim (formato HH:MM)
      endTime: {
        type: String,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      }
    },

    // Condições baseadas em saldo
    balanceConditions: {
      // Saldo mínimo da carteira
      minWalletBalance: {
        type: Number,
        default: 0
      },

      // Saldo máximo da carteira
      maxWalletBalance: {
        type: Number,
        default: null
      }
    }
  },

  // Configurações de divisão
  splitConfiguration: {
    // Para regras de percentual
    percentageRules: [{
      // Endereço de destino
      destinationAddress: {
        type: String,
        match: /^G[A-Z2-7]{55}$/,
        required: function() {
          return this.parent().parent().ruleType === 'percentage';
        }
      },

      // Percentual (0-100)
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        required: function() {
          return this.parent().parent().ruleType === 'percentage';
        }
      },

      // Descrição do destinatário
      description: {
        type: String,
        trim: true,
        maxlength: 200
      }
    }],

    // Para regras de valor fixo
    fixedAmountRules: [{
      // Endereço de destino
      destinationAddress: {
        type: String,
        match: /^G[A-Z2-7]{55}$/,
        required: function() {
          return this.parent().parent().ruleType === 'fixed_amount';
        }
      },

      // Valor fixo em USDC
      amount: {
        type: Number,
        min: 0.000001,
        required: function() {
          return this.parent().parent().ruleType === 'fixed_amount';
        }
      },

      // Descrição do destinatário
      description: {
        type: String,
        trim: true,
        maxlength: 200
      }
    }],

    // Para regras baseadas em prioridade
    priorityRules: [{
      // Endereço de destino
      destinationAddress: {
        type: String,
        match: /^G[A-Z2-7]{55}$/,
        required: function() {
          return this.parent().parent().ruleType === 'priority_based';
        }
      },

      // Prioridade (1 = mais alta)
      priority: {
        type: Number,
        min: 1,
        required: function() {
          return this.parent().parent().ruleType === 'priority_based';
        }
      },

      // Valor ou percentual
      allocation: {
        type: Number,
        min: 0,
        required: function() {
          return this.parent().parent().ruleType === 'priority_based';
        }
      },

      // Tipo de alocação (percentage ou fixed)
      allocationType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: function() {
          return this.parent().parent().ruleType === 'priority_based';
        }
      },

      // Descrição do destinatário
      description: {
        type: String,
        trim: true,
        maxlength: 200
      }
    }]
  },

  // Configurações avançadas
  advancedSettings: {
    // Permitir divisão parcial se saldo insuficiente
    allowPartialSplit: {
      type: Boolean,
      default: false
    },

    // Valor mínimo para cada destinatário
    minAmountPerDestination: {
      type: Number,
      default: 0.000001,
      min: 0.000001
    },

    // Arredondar valores para evitar frações
    roundAmounts: {
      type: Boolean,
      default: true
    },

    // Número de casas decimais para arredondamento
    decimalPlaces: {
      type: Number,
      default: 6,
      min: 1,
      max: 6
    },

    // Ação para valores restantes após arredondamento
    remainderAction: {
      type: String,
      enum: ['keep_in_wallet', 'add_to_first', 'add_to_last', 'distribute_evenly'],
      default: 'keep_in_wallet'
    }
  },

  // Histórico de execuções
  executionHistory: [{
    // Data de execução
    executedAt: {
      type: Date,
      default: Date.now
    },

    // ID da transação que ativou a regra
    triggerTransactionId: {
      type: String
    },

    // Valor total processado
    totalAmount: {
      type: Number,
      required: true
    },

    // Detalhes das divisões executadas
    splits: [{
      destinationAddress: String,
      amount: Number,
      percentage: Number,
      status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'pending'
      },
      transactionHash: String,
      error: String
    }],

    // Status geral da execução
    status: {
      type: String,
      enum: ['success', 'partial_success', 'failed'],
      required: true
    },

    // Mensagem de erro se houver
    errorMessage: String
  }],

  // Metadados
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Data de última execução
  lastExecutedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'fund_split_rules'
});

// Índices compostos
fundSplitRuleSchema.index({ walletId: 1, status: 1, priority: 1 });
fundSplitRuleSchema.index({ ruleType: 1, status: 1 });
fundSplitRuleSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual para total de execuções
fundSplitRuleSchema.virtual('totalExecutions').get(function() {
  return this.executionHistory.length;
});

// Virtual para última execução
fundSplitRuleSchema.virtual('lastExecution').get(function() {
  if (this.executionHistory.length === 0) return null;
  return this.executionHistory[this.executionHistory.length - 1];
});

// Virtual para taxa de sucesso
fundSplitRuleSchema.virtual('successRate').get(function() {
  if (this.executionHistory.length === 0) return 0;
  const successfulExecutions = this.executionHistory.filter(
    exec => exec.status === 'success'
  ).length;
  return (successfulExecutions / this.executionHistory.length) * 100;
});

// Middleware para validação antes de salvar
fundSplitRuleSchema.pre('save', function(next) {
  // Validar que a soma dos percentuais não exceda 100%
  if (this.ruleType === 'percentage') {
    const totalPercentage = this.splitConfiguration.percentageRules.reduce(
      (sum, rule) => sum + rule.percentage, 0
    );
    
    if (totalPercentage > 100) {
      return next(new Error('A soma dos percentuais não pode exceder 100%'));
    }
  }

  // Validar que há pelo menos uma regra de divisão
  const hasRules = 
    this.splitConfiguration.percentageRules.length > 0 ||
    this.splitConfiguration.fixedAmountRules.length > 0 ||
    this.splitConfiguration.priorityRules.length > 0;

  if (!hasRules) {
    return next(new Error('Deve haver pelo menos uma regra de divisão configurada'));
  }

  // Atualizar timestamp
  this.updatedAt = new Date();
  
  next();
});

// Método para verificar se a regra deve ser executada
fundSplitRuleSchema.methods.shouldExecute = function(transactionData) {
  // Verificar status
  if (this.status !== 'active') return false;

  // Verificar valor mínimo/máximo
  if (transactionData.amount < this.conditions.minAmount) return false;
  if (this.conditions.maxAmount && transactionData.amount > this.conditions.maxAmount) return false;

  // Verificar tipo de transação
  if (this.conditions.transactionTypes.length > 0 && 
      !this.conditions.transactionTypes.includes('all') &&
      !this.conditions.transactionTypes.includes(transactionData.type)) {
    return false;
  }

  // Verificar condições de tempo
  if (this.conditions.timeConditions.daysOfWeek.length > 0) {
    const currentDay = new Date().getDay();
    if (!this.conditions.timeConditions.daysOfWeek.includes(currentDay)) {
      return false;
    }
  }

  return true;
};

// Método para calcular divisões
fundSplitRuleSchema.methods.calculateSplits = function(amount) {
  const splits = [];
  let remainingAmount = amount;

  switch (this.ruleType) {
    case 'percentage':
      for (const rule of this.splitConfiguration.percentageRules) {
        const splitAmount = (amount * rule.percentage) / 100;
        const roundedAmount = this.advancedSettings.roundAmounts 
          ? Math.round(splitAmount * Math.pow(10, this.advancedSettings.decimalPlaces)) / Math.pow(10, this.advancedSettings.decimalPlaces)
          : splitAmount;

        if (roundedAmount >= this.advancedSettings.minAmountPerDestination) {
          splits.push({
            destinationAddress: rule.destinationAddress,
            amount: roundedAmount,
            percentage: rule.percentage,
            description: rule.description
          });
          remainingAmount -= roundedAmount;
        }
      }
      break;

    case 'fixed_amount':
      for (const rule of this.splitConfiguration.fixedAmountRules) {
        if (remainingAmount >= rule.amount) {
          splits.push({
            destinationAddress: rule.destinationAddress,
            amount: rule.amount,
            description: rule.description
          });
          remainingAmount -= rule.amount;
        } else if (this.advancedSettings.allowPartialSplit) {
          splits.push({
            destinationAddress: rule.destinationAddress,
            amount: remainingAmount,
            description: rule.description
          });
          remainingAmount = 0;
          break;
        }
      }
      break;

    case 'priority_based':
      // Ordenar por prioridade
      const sortedRules = this.splitConfiguration.priorityRules.sort(
        (a, b) => a.priority - b.priority
      );

      for (const rule of sortedRules) {
        let splitAmount;
        if (rule.allocationType === 'percentage') {
          splitAmount = (amount * rule.allocation) / 100;
        } else {
          splitAmount = rule.allocation;
        }

        const roundedAmount = this.advancedSettings.roundAmounts 
          ? Math.round(splitAmount * Math.pow(10, this.advancedSettings.decimalPlaces)) / Math.pow(10, this.advancedSettings.decimalPlaces)
          : splitAmount;

        if (remainingAmount >= roundedAmount && roundedAmount >= this.advancedSettings.minAmountPerDestination) {
          splits.push({
            destinationAddress: rule.destinationAddress,
            amount: roundedAmount,
            priority: rule.priority,
            description: rule.description
          });
          remainingAmount -= roundedAmount;
        } else if (this.advancedSettings.allowPartialSplit && remainingAmount > 0) {
          splits.push({
            destinationAddress: rule.destinationAddress,
            amount: remainingAmount,
            priority: rule.priority,
            description: rule.description
          });
          remainingAmount = 0;
          break;
        }
      }
      break;
  }

  return {
    splits,
    remainingAmount,
    totalSplitAmount: amount - remainingAmount
  };
};

// Método para registrar execução
fundSplitRuleSchema.methods.recordExecution = function(executionData) {
  this.executionHistory.push(executionData);
  this.lastExecutedAt = new Date();
  return this.save();
};

// Método estático para buscar regras ativas por carteira
fundSplitRuleSchema.statics.findActiveRulesByWallet = function(walletId) {
  return this.find({
    walletId,
    status: 'active'
  }).sort({ priority: 1 });
};

// Método estático para buscar regras por tipo
fundSplitRuleSchema.statics.findRulesByType = function(ruleType, walletId = null) {
  const query = { ruleType, status: 'active' };
  if (walletId) query.walletId = walletId;
  
  return this.find(query).sort({ priority: 1 });
};

module.exports = mongoose.model('FundSplitRule', fundSplitRuleSchema);