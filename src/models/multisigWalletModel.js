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
  console.warn('Usando modelo MultisigWallet mock devido à falha na conexão com o banco');
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
 * Modelo de Carteira Multisig para PostgreSQL usando Sequelize
 */
const MultisigWallet = sequelize.define('MultisigWallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  walletId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Nome da carteira é obrigatório'
      },
      len: {
        args: [1, 100],
        msg: 'Nome deve ter entre 1 e 100 caracteres'
      }
    }
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Descrição não pode ter mais de 500 caracteres'
      }
    }
  },
  contractAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  threshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Threshold deve ser pelo menos 1'
      }
    }
  },
  participants: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(20, 7),
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Saldo não pode ser negativo'
      }
    }
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
    allowNull: false,
    validate: {
      isIn: {
        args: [['active', 'inactive', 'frozen']],
        msg: 'Status deve ser active, inactive ou frozen'
      }
    }
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Configurações avançadas de administração
  adminSettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      allowMemberInvitation: true,
      allowThresholdChange: true,
      allowWalletDeletion: false,
      requireAdminApprovalForTransactions: false,
      maxTransactionAmount: null,
      dailyTransactionLimit: null,
      autoApproveSmallTransactions: false,
      smallTransactionThreshold: 100
    },
    allowNull: false
  },
  // Regras de divisão de fundos
  divisionRules: {
    type: DataTypes.JSONB,
    defaultValue: {
      enabled: false,
      rules: [],
      autoExecute: false
    },
    allowNull: false
  },
  // Configurações de notificação
  notificationSettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      notifyOnTransactionProposal: true,
      notifyOnTransactionApproval: true,
      notifyOnTransactionExecution: true,
      notifyOnMemberChanges: true,
      notifyOnSettingsChanges: true
    },
    allowNull: false
  },
  // Limites e restrições
  limits: {
    type: DataTypes.JSONB,
    defaultValue: {
      maxParticipants: 20,
      maxDailyTransactions: 50,
      maxTransactionAmount: null,
      cooldownPeriod: 0
    },
    allowNull: false
  }
}, {
  tableName: 'multisig_wallets',
  timestamps: true,
  indexes: [
    {
      fields: ['walletId']
    },
    {
      fields: ['contractAddress']
    },
    {
      fields: ['createdBy']
    },
    {
      fields: ['status']
    }
  ]
});

// Métodos de instância para gerenciamento de permissões
MultisigWallet.prototype.isAdmin = function(userId) {
  const participants = this.participants || [];
  const participant = participants.find(p => p.userId === userId);
  return participant && participant.role === 'admin';
};

MultisigWallet.prototype.isSuperAdmin = function(userId) {
  return this.createdBy === userId;
};

MultisigWallet.prototype.hasPermission = function(userId, permission) {
  if (this.isSuperAdmin(userId)) return true;
  
  const participant = this.participants.find(p => p.userId === userId);
  if (!participant) return false;
  
  // Verificar permissões específicas baseadas no role
  switch (permission) {
    case 'add_member':
      return this.isAdmin(userId) && this.adminSettings.allowMemberInvitation;
    case 'remove_member':
      return this.isAdmin(userId);
    case 'change_threshold':
      return this.isAdmin(userId) && this.adminSettings.allowThresholdChange;
    case 'delete_wallet':
      return this.isSuperAdmin(userId) && this.adminSettings.allowWalletDeletion;
    case 'modify_settings':
      return this.isAdmin(userId);
    case 'approve_transaction':
      return participant.role === 'admin' || participant.role === 'participant';
    case 'propose_transaction':
      return participant.role === 'admin' || participant.role === 'participant';
    default:
      return false;
  }
};

MultisigWallet.prototype.addParticipant = function(userId, publicKey, role = 'participant', addedBy) {
  const participants = this.participants || [];
  
  // Verificar se já é participante
  if (participants.some(p => p.userId === userId)) {
    throw new Error('Usuário já é participante desta carteira');
  }
  
  // Verificar limite de participantes
  if (participants.length >= this.limits.maxParticipants) {
    throw new Error(`Limite máximo de ${this.limits.maxParticipants} participantes atingido`);
  }
  
  participants.push({
    userId,
    publicKey,
    role,
    addedBy,
    addedAt: new Date(),
    status: 'active'
  });
  
  this.participants = participants;
};

MultisigWallet.prototype.removeParticipant = function(userId) {
  const participants = this.participants || [];
  const participantIndex = participants.findIndex(p => p.userId === userId);
  
  if (participantIndex === -1) {
    throw new Error('Participante não encontrado');
  }
  
  // Não permitir remover se isso deixar o threshold inválido
  if (participants.length - 1 < this.threshold) {
    throw new Error('Não é possível remover participante: threshold ficaria inválido');
  }
  
  participants.splice(participantIndex, 1);
  this.participants = participants;
};

MultisigWallet.prototype.updateParticipantRole = function(userId, newRole, updatedBy) {
  const participants = this.participants || [];
  const participant = participants.find(p => p.userId === userId);
  
  if (!participant) {
    throw new Error('Participante não encontrado');
  }
  
  participant.role = newRole;
  participant.updatedBy = updatedBy;
  participant.updatedAt = new Date();
  
  this.participants = participants;
};

MultisigWallet.prototype.updateAdminSettings = function(newSettings, updatedBy) {
  this.adminSettings = { ...this.adminSettings, ...newSettings };
  
  // Adicionar ao log de auditoria
  const auditLog = this.auditLog || [];
  auditLog.push({
    action: 'admin_settings_updated',
    userId: updatedBy,
    timestamp: new Date(),
    changes: newSettings
  });
  this.auditLog = auditLog;
};

MultisigWallet.prototype.canExecuteTransaction = function(amount) {
  const settings = this.adminSettings;
  
  // Verificar limite máximo por transação
  if (settings.maxTransactionAmount && amount > settings.maxTransactionAmount) {
    return false;
  }
  
  // Verificar se é uma transação pequena que pode ser auto-aprovada
  if (settings.autoApproveSmallTransactions && amount <= settings.smallTransactionThreshold) {
    return true;
  }
  
  return true;
};

module.exports = MultisigWallet;