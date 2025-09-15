const mongoose = require('mongoose');

const hackathonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Um hackathon precisa ter um título'],
      trim: true,
      maxlength: [100, 'Um título de hackathon não pode ter mais de 100 caracteres'],
      minlength: [5, 'Um título de hackathon precisa ter pelo menos 5 caracteres'],
    },
    description: {
      type: String,
      required: [true, 'Um hackathon precisa ter uma descrição'],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Um hackathon precisa ter uma data de início'],
    },
    endDate: {
      type: Date,
      required: [true, 'Um hackathon precisa ter uma data de término'],
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: 'A data de término deve ser posterior à data de início',
      },
    },
    location: {
      type: String,
      required: [true, 'Um hackathon precisa ter uma localização'],
      trim: true,
    },
    maxParticipants: {
      type: Number,
      default: 100,
    },
    registrationDeadline: {
      type: Date,
      required: [true, 'Um hackathon precisa ter uma data limite para inscrições'],
      validate: {
        validator: function (value) {
          return value < this.startDate;
        },
        message: 'A data limite para inscrições deve ser anterior à data de início',
      },
    },
    prizes: [
      {
        place: {
          type: String,
          required: [true, 'Um prêmio precisa ter uma colocação'],
          enum: ['1º lugar', '2º lugar', '3º lugar', 'Menção honrosa'],
        },
        description: {
          type: String,
          required: [true, 'Um prêmio precisa ter uma descrição'],
        },
        value: {
          type: Number,
        },
      },
    ],
    organizer: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Um hackathon precisa ter um organizador'],
    },
    participants: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    teams: [
      {
        name: {
          type: String,
          required: [true, 'Uma equipe precisa ter um nome'],
          trim: true,
        },
        members: [
          {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
          },
        ],
        project: {
          name: String,
          description: String,
          repositoryUrl: String,
        },
      },
    ],
    status: {
      type: String,
      enum: ['planejado', 'inscrições abertas', 'em andamento', 'finalizado', 'cancelado'],
      default: 'planejado',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware para popular o organizador e participantes
hackathonSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'organizer',
    select: 'name email photo',
  });
  next();
});

const Hackathon = mongoose.model('Hackathon', hackathonSchema);

module.exports = Hackathon;