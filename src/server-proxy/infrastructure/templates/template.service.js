// src/services/template.service.js
const fs = require('fs/promises'); // Usamos a versão de 'promises' do fs
const path = require('path');
const handlebars = require('handlebars');

/**
 * Processa um template HTML com os dados fornecidos.
 * @param {string} templateName - O nome do arquivo de template (ex: 'credential-email.html').
 *- O nome do arquivo de template (ex: 'credential-email.html').
 * @param {object} data - Um objeto com os dados a serem inseridos no template.
 * @returns {Promise<string>} O HTML final como string.
 */
async function parseHtmlTemplate(templateName, data) {
  try {
    // Constrói o caminho completo para o arquivo de template
    const templatePath = path.resolve(__dirname, '..', 'templates/assets', templateName);

    // Lê o conteúdo do arquivo HTML
    const htmlContent = await fs.readFile(templatePath, 'utf-8');

    // Compila o template usando o Handlebars
    const template = handlebars.compile(htmlContent);

    // Executa o template com os dados e retorna o HTML final
    const finalHtml = template(data);
    
    return finalHtml;
  } catch (error) {
    console.error(`Erro ao processar o template ${templateName}:`, error);
    throw new Error('Não foi possível gerar o corpo do email a partir do template.');
  }
}

module.exports = { parseHtmlTemplate };