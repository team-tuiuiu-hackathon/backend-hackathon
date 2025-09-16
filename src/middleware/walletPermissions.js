const MultisigWallet = require('../models/multisigWalletModel');

/**
 * Middleware para verificar permissões em carteiras multisig
 */
class WalletPermissionMiddleware {
  
  /**
   * Verificar se o usuário tem permissão específica na carteira
   */
  static checkPermission(permission) {
    return async (req, res, next) => {
      try {
        const { walletId } = req.params;
        const userId = req.user.id;

        if (!walletId) {
          return res.status(400).json({
            status: 'error',
            message: 'ID da carteira é obrigatório'
          });
        }

        const wallet = await MultisigWallet.findByPk(walletId);
        if (!wallet) {
          return res.status(404).json({
            status: 'error',
            message: 'Carteira não encontrada'
          });
        }

        // Verificar se o usuário tem a permissão necessária
        if (!wallet.hasPermission(userId, permission)) {
          return res.status(403).json({
            status: 'error',
            message: `Acesso negado: você não tem permissão para ${permission}`
          });
        }

        // Adicionar a carteira ao request para uso posterior
        req.wallet = wallet;
        next();

      } catch (error) {
        console.error('Erro na verificação de permissões:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    };
  }

  /**
   * Verificar se o usuário é administrador da carteira
   */
  static requireAdmin() {
    return async (req, res, next) => {
      try {
        const { walletId } = req.params;
        const userId = req.user.id;

        const wallet = await MultisigWallet.findByPk(walletId);
        if (!wallet) {
          return res.status(404).json({
            status: 'error',
            message: 'Carteira não encontrada'
          });
        }

        if (!wallet.isAdmin(userId)) {
          return res.status(403).json({
            status: 'error',
            message: 'Acesso negado: apenas administradores podem realizar esta ação'
          });
        }

        req.wallet = wallet;
        next();

      } catch (error) {
        console.error('Erro na verificação de admin:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    };
  }

  /**
   * Verificar se o usuário é super administrador (criador) da carteira
   */
  static requireSuperAdmin() {
    return async (req, res, next) => {
      try {
        const { walletId } = req.params;
        const userId = req.user.id;

        const wallet = await MultisigWallet.findByPk(walletId);
        if (!wallet) {
          return res.status(404).json({
            status: 'error',
            message: 'Carteira não encontrada'
          });
        }

        if (!wallet.isSuperAdmin(userId)) {
          return res.status(403).json({
            status: 'error',
            message: 'Acesso negado: apenas o criador da carteira pode realizar esta ação'
          });
        }

        req.wallet = wallet;
        next();

      } catch (error) {
        console.error('Erro na verificação de super admin:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    };
  }

  /**
   * Verificar se o usuário é participante da carteira
   */
  static requireParticipant() {
    return async (req, res, next) => {
      try {
        const { walletId } = req.params;
        const userId = req.user.id;

        const wallet = await MultisigWallet.findByPk(walletId);
        if (!wallet) {
          return res.status(404).json({
            status: 'error',
            message: 'Carteira não encontrada'
          });
        }

        const participants = wallet.participants || [];
        const isParticipant = participants.some(p => p.userId === userId && p.status === 'active');
        
        if (!isParticipant) {
          return res.status(403).json({
            status: 'error',
            message: 'Acesso negado: você não é participante desta carteira'
          });
        }

        req.wallet = wallet;
        next();

      } catch (error) {
        console.error('Erro na verificação de participante:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    };
  }

  /**
   * Verificar limites de transação
   */
  static checkTransactionLimits() {
    return async (req, res, next) => {
      try {
        const { amount } = req.body;
        const wallet = req.wallet;

        if (!wallet) {
          return res.status(400).json({
            status: 'error',
            message: 'Carteira não encontrada no contexto da requisição'
          });
        }

        // Verificar se a transação pode ser executada baseada nos limites
        if (!wallet.canExecuteTransaction(amount)) {
          return res.status(400).json({
            status: 'error',
            message: 'Transação excede os limites configurados para esta carteira'
          });
        }

        next();

      } catch (error) {
        console.error('Erro na verificação de limites:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    };
  }

  /**
   * Verificar se a carteira está ativa
   */
  static requireActiveWallet() {
    return async (req, res, next) => {
      try {
        const wallet = req.wallet;

        if (!wallet) {
          return res.status(400).json({
            status: 'error',
            message: 'Carteira não encontrada no contexto da requisição'
          });
        }

        if (wallet.status !== 'active') {
          return res.status(403).json({
            status: 'error',
            message: `Carteira está ${wallet.status}. Apenas carteiras ativas podem realizar transações`
          });
        }

        next();

      } catch (error) {
        console.error('Erro na verificação de status da carteira:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    };
  }
}

module.exports = WalletPermissionMiddleware;