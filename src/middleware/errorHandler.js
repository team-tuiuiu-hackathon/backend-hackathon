/**
 * Middleware para tratamento de erros
 */

// Tratamento de erros em ambiente de desenvolvimento
const sendErrorDev = (err, res) => {
  // Log detalhado para desenvolvimento
  console.error('🚨 ERRO DETALHADO:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    timestamp: new Date().toISOString()
  });

  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
};

// Tratamento de erros em ambiente de produção
const sendErrorProd = (err, res) => {
  // Log seguro para produção (sem informações sensíveis)
  console.error('🔥 ERRO PRODUÇÃO:', {
    message: err.isOperational ? err.message : 'Erro interno',
    statusCode: err.statusCode,
    timestamp: new Date().toISOString(),
    errorId: err.errorId || 'unknown'
  });

  // Erros operacionais: enviar mensagem para o cliente
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      timestamp: new Date().toISOString(),
      errorId: err.errorId
    });
  } else {
    // Erros de programação ou desconhecidos: não vazar detalhes
    res.status(500).json({
      status: 'error',
      message: 'Algo deu errado!',
      timestamp: new Date().toISOString(),
      errorId: 'internal_error'
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

const handleRateLimitError = () => new AppError('Muitas tentativas. Tente novamente mais tarde.', 429);

const handlePayloadTooLargeError = () => new AppError('Payload muito grande. Reduza o tamanho dos dados.', 413);

const handleSyntaxError = () => new AppError('Formato de dados inválido.', 400);

// Classe de erro personalizada
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errorCode = errorCode;
    this.errorId = this.generateErrorId();
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Middleware principal de tratamento de erros
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log da requisição que causou o erro
  console.error('📍 CONTEXTO DO ERRO:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Tratamento de erros específicos
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'SyntaxError') error = handleSyntaxError();
    if (error.type === 'entity.too.large') error = handlePayloadTooLargeError();
    if (error.statusCode === 429) error = handleRateLimitError();

    sendErrorProd(error, res);
  }
};

// Exportações
module.exports = errorHandler;
module.exports.AppError = AppError;