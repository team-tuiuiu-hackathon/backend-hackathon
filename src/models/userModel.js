/**
 * MODELO REMOVIDO - AUTENTICAÇÃO TRADICIONAL DESCONTINUADA
 * 
 * Este modelo foi removido em favor da autenticação Web3 apenas.
 * Use o modelo Web3User para todas as operações de usuário.
 * 
 * @deprecated Use Web3User em vez deste modelo
 */

const Web3User = require('./web3UserModel');

// Redirecionamento para Web3User para compatibilidade temporária
module.exports = Web3User;

console.warn('AVISO: O modelo User tradicional foi removido. Use Web3User para autenticação Web3.');