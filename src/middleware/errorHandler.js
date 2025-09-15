/**
 * Middleware para tratamento de erros
 */

// Tratamento de erros em ambiente de desenvolvimento
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Tratamento de erros em ambiente de produção
const sendErrorProd = (err, res) => {
  // Erros operacionais: enviar mensagem para o cliente
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Erros de programação ou desconhecidos: não vazar detalhes
    console.error('ERRO 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Algo deu errado!',
    });
  }
};

// Tratamento de erros específicos
const handleCastErrorDB = (err) => {
  const message = `Inválido ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Valor duplicado: ${value}. Por favor, use outro valor!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Dados de entrada inválidos. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Token inválido. Por favor, faça login novamente!', 401);

const handleJWTExpiredError = () => new AppError('Seu token expirou! Por favor, faça login novamente.', 401);

// Classe de erro personalizada
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware principal de tratamento de erros
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

// Exportando a classe AppError para uso em outros módulos
module.exports.AppError = AppError;