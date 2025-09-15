const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Função para obter a instância do Sequelize correta
const getSequelize = () => {
  // Se estivermos em ambiente de teste, usar o banco de teste
  if (process.env.NODE_ENV === 'test') {
    const { testSequelize } = require('../config/testDatabase');
    return testSequelize;
  }
  // Caso contrário, usar o banco principal
  const { sequelize } = require('../config/database');
  return sequelize;
};

const sequelize = getSequelize();

/**
 * Modelo de Usuário Simplificado para PostgreSQL usando Sequelize
 * Contém apenas os campos essenciais para cadastro
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    comment: 'ID único do usuário (chave primária)'
  },
  fullName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Nome completo é obrigatório'
      },
      len: {
        args: [2, 255],
        msg: 'Nome completo deve ter entre 2 e 255 caracteres'
      }
    },
    comment: 'Nome completo do usuário'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: {
      name: 'unique_email',
      msg: 'Este email já está cadastrado'
    },
    validate: {
      isEmail: {
        msg: 'Email deve ter um formato válido'
      },
      notEmpty: {
        msg: 'Email é obrigatório'
      }
    },
    comment: 'Email único do usuário'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: {
        args: [8, 255],
        msg: 'Senha deve ter pelo menos 8 caracteres'
      },
      notEmpty: {
        msg: 'Senha é obrigatória'
      }
    },
    comment: 'Senha criptografada do usuário'
  },
  passwordConfirm: {
    type: DataTypes.VIRTUAL,
    allowNull: true, // Tornando opcional
    validate: {
      isPasswordMatch(value) {
        // Só valida se o valor for fornecido
        if (value && value !== this.password) {
          throw new Error('Senha e confirmação de senha devem ser iguais');
        }
      }
    },
    comment: 'Campo virtual para confirmação de senha'
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'organizer'),
    defaultValue: 'user',
    allowNull: false,
    validate: {
      isIn: {
        args: [['user', 'admin', 'organizer']],
        msg: 'Role deve ser user, admin ou organizer'
      }
    },
    comment: 'Papel do usuário no sistema'
  }
}, {
  tableName: 'users',
  timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  paranoid: false, // Não usar soft delete
  indexes: [
    {
      unique: true,
      fields: ['email'],
      name: 'idx_users_email'
    }
  ],
  hooks: {
    // Hook para criptografar a senha antes de salvar
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  }
});

// Método de instância para verificar senha
User.prototype.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para verificar se a senha foi alterada após o token ser emitido
User.prototype.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  // Falso significa que a senha não foi alterada
  return false;
};

module.exports = User;