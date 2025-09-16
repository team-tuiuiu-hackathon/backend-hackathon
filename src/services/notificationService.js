const MultisigWallet = require('../models/multisigWalletModel');
const User = require('../models/userModel');
const NotificationQueue = require('../models/notificationQueueModel');
const ServiceStatistics = require('../models/serviceStatisticsModel');

class NotificationService {
  
  // BE10 - Notificar membros da carteira sobre eventos de transação
  static async notifyWalletMembers(walletId, event, transactionData, excludeUserId = null) {
    const startTime = Date.now();
    
    try {
      const wallet = await MultisigWallet.findById(walletId)
        .populate('participants.userId', 'name email notificationPreferences');
      
      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      // Filtrar participantes (excluir o usuário que iniciou a ação se especificado)
      const recipients = wallet.participants
        .filter(p => p.userId._id.toString() !== excludeUserId?.toString())
        .map(p => p.userId);

      const notifications = [];

      for (const user of recipients) {
        // Criar notificação na fila do banco de dados
        const notification = await NotificationQueue.createNotification({
          recipientType: this.getPreferredNotificationType(user),
          recipientAddress: this.getRecipientAddress(user),
          subject: this.getNotificationTitle(event, {
            walletId: wallet._id,
            walletName: wallet.name,
            transactionData
          }),
          message: this.getNotificationMessage(event, {
            walletId: wallet._id,
            walletName: wallet.name,
            transactionData
          }),
          templateName: `wallet_${event}`,
          templateData: {
            userName: user.name,
            walletName: wallet.name,
            transactionData
          },
          priority: this.getNotificationPriority(event),
          metadata: {
            userId: user._id,
            walletId: wallet._id,
            event,
            excludeUserId
          }
        });
        
        notifications.push(notification);
      }

      const executionTime = Date.now() - startTime;
      await ServiceStatistics.recordCall('NotificationService', 'notifyWalletMembers', executionTime, true);

      return notifications;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      await ServiceStatistics.recordCall('NotificationService', 'notifyWalletMembers', executionTime, false, error.message);
      console.error('Erro ao notificar membros da carteira:', error);
      throw error;
    }
  }

  // Criar notificação no banco de dados
  static async createNotification(user, event, data) {
    const notificationData = {
      userId: user._id,
      type: this.getNotificationType(event),
      title: this.getNotificationTitle(event, data),
      message: this.getNotificationMessage(event, data),
      data: {
        walletId: data.walletId,
        walletName: data.walletName,
        transactionId: data.transactionData?.transactionId,
        transactionType: data.transactionData?.type,
        amount: data.transactionData?.amount,
        currency: data.transactionData?.currency
      },
      status: 'unread',
      createdAt: new Date()
    };

    // Aqui você salvaria no banco de dados
    // const notification = new Notification(notificationData);
    // await notification.save();
    
    // Por enquanto, retornamos o objeto
    return notificationData;
  }

  // Enviar notificação baseada nas preferências do usuário
  static async sendNotificationByPreference(user, notification) {
    const preferences = user.notificationPreferences || {
      email: true,
      push: true,
      sms: false
    };

    const promises = [];

    if (preferences.email) {
      promises.push(this.sendEmailNotification(user.email, notification));
    }

    if (preferences.push) {
      promises.push(this.sendPushNotification(user._id, notification));
    }

    if (preferences.sms && user.phone) {
      promises.push(this.sendSMSNotification(user.phone, notification));
    }

    await Promise.allSettled(promises);
  }

  // Enviar notificação por email
  static async sendEmailNotification(email, notification) {
    try {
      // Implementar integração com serviço de email (SendGrid, AWS SES, etc.)
      console.log(`📧 Email enviado para ${email}:`, {
        subject: notification.title,
        message: notification.message
      });

      // Exemplo de implementação com nodemailer ou serviço de email
      /*
      const emailService = require('./emailService');
      await emailService.send({
        to: email,
        subject: notification.title,
        html: this.generateEmailTemplate(notification)
      });
      */

    } catch (error) {
      console.error('Erro ao enviar email:', error);
    }
  }

  // Enviar notificação push
  static async sendPushNotification(userId, notification) {
    try {
      // Implementar integração com serviço de push (Firebase, OneSignal, etc.)
      console.log(`🔔 Push notification enviada para usuário ${userId}:`, {
        title: notification.title,
        message: notification.message
      });

      // Exemplo de implementação com Firebase
      /*
      const firebaseService = require('./firebaseService');
      await firebaseService.sendToUser(userId, {
        title: notification.title,
        body: notification.message,
        data: notification.data
      });
      */

    } catch (error) {
      console.error('Erro ao enviar push notification:', error);
    }
  }

  // Enviar notificação por SMS
  static async sendSMSNotification(phone, notification) {
    try {
      // Implementar integração com serviço de SMS (Twilio, AWS SNS, etc.)
      console.log(`📱 SMS enviado para ${phone}:`, notification.message);

      // Exemplo de implementação com Twilio
      /*
      const twilioService = require('./twilioService');
      await twilioService.send({
        to: phone,
        body: notification.message
      });
      */

    } catch (error) {
      console.error('Erro ao enviar SMS:', error);
    }
  }

  // Obter tipo de notificação baseado no evento
  static getNotificationType(event) {
    const typeMap = {
      'transaction_proposed': 'transaction',
      'transaction_signed': 'transaction',
      'transaction_approved': 'transaction',
      'transaction_executed': 'transaction',
      'transaction_rejected': 'transaction',
      'wallet_member_added': 'wallet',
      'wallet_member_removed': 'wallet',
      'wallet_threshold_changed': 'wallet',
      'division_rule_added': 'division',
      'division_executed': 'division'
    };

    return typeMap[event] || 'general';
  }

  // Gerar título da notificação
  static getNotificationTitle(event, data) {
    const { walletName, transactionData } = data;

    switch (event) {
      case 'transaction_proposed':
        return `Nova transação proposta em ${walletName}`;
      
      case 'transaction_signed':
        return `Transação assinada em ${walletName}`;
      
      case 'transaction_approved':
        return `Transação aprovada em ${walletName}`;
      
      case 'transaction_executed':
        return `Transação executada em ${walletName}`;
      
      case 'transaction_rejected':
        return `Transação rejeitada em ${walletName}`;
      
      case 'wallet_member_added':
        return `Novo membro adicionado à ${walletName}`;
      
      case 'wallet_member_removed':
        return `Membro removido de ${walletName}`;
      
      case 'wallet_threshold_changed':
        return `Threshold alterado em ${walletName}`;
      
      case 'division_rule_added':
        return `Nova regra de divisão em ${walletName}`;
      
      case 'division_executed':
        return `Divisão automática executada em ${walletName}`;
      
      default:
        return `Atualização em ${walletName}`;
    }
  }

  // Gerar mensagem da notificação
  static getNotificationMessage(event, data) {
    const { walletName, transactionData } = data;
    const amount = transactionData?.amount;
    const currency = transactionData?.currency || 'USDC';
    const type = transactionData?.type;

    switch (event) {
      case 'transaction_proposed':
        return `Uma nova transação de ${type} no valor de ${amount} ${currency} foi proposta e aguarda assinaturas.`;
      
      case 'transaction_signed':
        return `Uma transação foi assinada. Progresso: ${transactionData?.signatureProgress?.current}/${transactionData?.signatureProgress?.required} assinaturas.`;
      
      case 'transaction_approved':
        return `A transação de ${amount} ${currency} foi aprovada e está pronta para execução.`;
      
      case 'transaction_executed':
        return `A transação de ${amount} ${currency} foi executada com sucesso na blockchain.`;
      
      case 'transaction_rejected':
        return `A transação de ${amount} ${currency} foi rejeitada por um administrador.`;
      
      case 'wallet_member_added':
        return `Um novo membro foi adicionado à carteira multisig.`;
      
      case 'wallet_member_removed':
        return `Um membro foi removido da carteira multisig.`;
      
      case 'wallet_threshold_changed':
        return `O threshold de assinaturas da carteira foi alterado.`;
      
      case 'division_rule_added':
        return `Uma nova regra de divisão automática foi configurada.`;
      
      case 'division_executed':
        return `Uma divisão automática de fundos foi executada.`;
      
      default:
        return `Houve uma atualização na carteira ${walletName}.`;
    }
  }

  // Gerar template HTML para email
  static generateEmailTemplate(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Carteira Multisig</h1>
          </div>
          <div class="content">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            ${notification.data.walletName ? `<p><strong>Carteira:</strong> ${notification.data.walletName}</p>` : ''}
            ${notification.data.amount ? `<p><strong>Valor:</strong> ${notification.data.amount} ${notification.data.currency}</p>` : ''}
            <p><a href="#" class="button">Ver Detalhes</a></p>
          </div>
          <div class="footer">
            <p>Esta é uma notificação automática do sistema de carteiras multisig.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Notificar sobre transação proposta
  static async notifyTransactionProposed(walletId, transactionData, proposedBy) {
    return this.notifyWalletMembers(
      walletId, 
      'transaction_proposed', 
      { transactionData }, 
      proposedBy
    );
  }

  // Notificar sobre transação assinada
  static async notifyTransactionSigned(walletId, transactionData, signedBy) {
    return this.notifyWalletMembers(
      walletId, 
      'transaction_signed', 
      { transactionData }, 
      signedBy
    );
  }

  // Notificar sobre transação aprovada
  static async notifyTransactionApproved(walletId, transactionData) {
    return this.notifyWalletMembers(
      walletId, 
      'transaction_approved', 
      { transactionData }
    );
  }

  // Notificar sobre transação executada
  static async notifyTransactionExecuted(walletId, transactionData) {
    return this.notifyWalletMembers(
      walletId, 
      'transaction_executed', 
      { transactionData }
    );
  }

  // Notificar sobre transação rejeitada
  static async notifyTransactionRejected(walletId, transactionData, rejectedBy) {
    return this.notifyWalletMembers(
      walletId, 
      'transaction_rejected', 
      { transactionData }, 
      rejectedBy
    );
  }
}

module.exports = NotificationService;