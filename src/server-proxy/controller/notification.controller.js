// src/controllers/notification.controller.js
const notificationService = require('../infrastructure/notificationManager/notification.service');

async function handleSendNotification(req, res) {
  const { type, payload } = req.body;

  if (!type || !payload) {
    return res.status(400).json({ message: 'Parâmetros "type" e "payload" são obrigatórios.' });
  }

  try {
    const result = await notificationService.sendNotification({ type, payload });
    res.status(200).json({ message: 'Notificação enviada com sucesso.', details: result });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Ocorreu um erro interno.' });
  }
}

module.exports = { handleSendNotification };