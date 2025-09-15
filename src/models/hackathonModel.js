const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Hackathon para PostgreSQL usando Sequelize
 */
const Hackathon = sequelize.define('Hackathon', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Um hackathon precisa ter um título'
      },
      len: {
        args: [5, 100],
        msg: 'Um título de hackathon deve ter entre 5 e 100 caracteres'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Um hackathon precisa ter uma descrição'
      }
    }
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Um hackathon precisa ter uma data de início'
      }
    }
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Um hackathon precisa ter uma data de término'
      },
      isAfterStartDate(value) {
        if (value <= this.startDate) {
          throw new Error('A data de término deve ser posterior à data de início');
        }
      }
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Um hackathon precisa ter uma localização'
      }
    }
  },
  maxParticipants: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  registrationDeadline: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Um hackathon precisa ter uma data limite para inscrições'
      },
      isBeforeStartDate(value) {
        if (value >= this.startDate) {
          throw new Error('A data limite para inscrições deve ser anterior à data de início');
        }
      }
    }
  },
  prizes: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  teams: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('planejado', 'inscrições abertas', 'em andamento', 'finalizado', 'cancelado'),
    defaultValue: 'planejado'
  },
  organizerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'hackathons',
  timestamps: true,
  indexes: [
    {
      fields: ['organizerId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['startDate', 'endDate']
    }
  ]
});

module.exports = Hackathon;