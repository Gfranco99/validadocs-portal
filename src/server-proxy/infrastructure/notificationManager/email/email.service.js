// src/services/email.service.js
const nodemailer = require('nodemailer');

// Configura o "transportador" de email usando as variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // `secure:true` para porta 465, `false` para as outras
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Envia um email.
 * @param {object} options - Opções do email.
 * @param {string} options.to - Destinatário.
 * @param {string} options.subject - Assunto do email.
 * @param {string} options.html - Conteúdo HTML do email.
 */
async function sendEmail({ to, subject, html }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      html: html,
    });
    console.log(`Email enviado com sucesso para ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Erro ao enviar email para ${to}:`, error);
    throw new Error('Falha no envio do email.');
  }
}

module.exports = { sendEmail };