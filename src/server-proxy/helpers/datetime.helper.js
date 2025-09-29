// dateHelper.js
const { DateTime } = require('luxon');

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data atual no fuso horário de Brasília como objeto Date.
 */
function getBrasiliaNow() {
  return DateTime.now().setZone(TIMEZONE).toJSDate();
}

/**
 * Retorna uma data futura em Brasília, com base em minutos de expiração.
 * @param {number} expiresInMin - minutos até expirar
 */
function getBrasiliaExpiration(expiresInMin) {  
  const now = DateTime.now().setZone(TIMEZONE);
  const expires = now.plus({ minutes: expiresInMin });

  return {
    now: now.toJSDate(),       // Date no horário de Brasília
    expires_at: expires.toJSDate(),   // Date com offset aplicado
    offset_minutes: expiresInMin      // útil para controle ou debug
  };
}

module.exports = {
  getBrasiliaNow,
  getBrasiliaExpiration
};