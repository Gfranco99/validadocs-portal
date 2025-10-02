// src/services/notification.service.js
const { sendEmail } = require('./email/email.service');

/**
 * Envia uma notificação através do canal especificado.
 * @param {object} options - Opções da notificação.
 * @param {'email' | 'whatsapp'} options.type - O tipo de notificação.
 * @param {object} options.payload - Os dados para a notificação (depende do tipo).
 */
async function sendNotification({ type, payload }) {
  switch (type) {
    case 'email':
      // O payload para email deve ter { to, subject, html }
      return sendEmail(payload);
    
    // case 'whatsapp':
    //   // O payload para whatsapp deve ter { to, body }
    //   return sendWhatsApp(payload);
      
    default:
      console.error(`Tipo de notificação inválido: ${type}`);
      throw new Error('Tipo de notificação não suportado.');
  }
}

module.exports = { sendNotification };