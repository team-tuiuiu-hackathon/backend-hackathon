const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Por favor, informe seu nome'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Por favor, informe seu email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Por favor, forneça um email válido'],
    },
    photo: {
      type: String,
      default: 'default.jpg',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    password: {
      type: String,
      required: [true, 'Por favor, forneça uma senha'],
      minlength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Por favor, confirme sua senha'],
      validate: {
        // Este validador só funciona em CREATE e SAVE!!!
        validator: function (el) {
          return el === this.password;
        },
        message: 'As senhas não são iguais!',
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware para criptografar a senha antes de salvar
userSchema.pre('save', async function (next) {
  // Só executa se a senha foi modificada
  if (!this.isModified('password')) return next();

  // Hash a senha com custo 12
  this.password = await bcrypt.hash(this.password, 12);

  // Não persiste o campo passwordConfirm
  this.passwordConfirm = undefined;
  next();
});

// Middleware para atualizar o campo passwordChangedAt quando a senha for alterada
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000; // Subtrai 1 segundo para garantir que o token seja criado após a alteração da senha
  next();
});

// Middleware para não mostrar usuários inativos
userSchema.pre(/^find/, function (next) {
  // this aponta para a query atual
  this.find({ active: { $ne: false } });
  next();
});

// Método para verificar se a senha está correta
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Método para verificar se a senha foi alterada após o token JWT ser emitido
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }

  // Falso significa que a senha NÃO foi alterada
  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;