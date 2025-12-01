// WhatsAppFileSender.js
const axios = require('axios');
const FormData = require('form-data');

class WhatsAppFileSender {
    constructor(phoneNumberId, accessToken) {
        this.phoneNumberId = phoneNumberId;
        this.accessToken = accessToken;
        this.http = axios.create({
            baseURL: `https://graph.facebook.com/v19.0/`,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            }
        });
    }

    /**
     * Envia um PDF processado para um contato do WhatsApp
     * @param {string} phoneNumber - Telefone internacional ex: 5511999999999
     * @param {Buffer} fileBuffer - Conteúdo do PDF
     * @param {string} fileName - Nome do arquivo enviado
     * @param {string} caption - Legenda opcional
     */
    async sendProcessedPdf(phoneNumber, fileBuffer, fileName = "resultado.pdf", caption = "Resultado da análise") {
        try {
            // 🔹 1. Upload do PDF
            const formData = new FormData();
            formData.append('file', fileBuffer, fileName);
            formData.append('type', 'application/pdf');

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/v19.0/${this.phoneNumberId}/media`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        ...formData.getHeaders()
                    }
                }
            );

            if (!uploadResponse.data?.id) {
                throw new Error("Falha ao fazer upload do arquivo.");
            }

            const mediaId = uploadResponse.data.id;
            console.log(`📎 Upload realizado com sucesso. Media ID: ${mediaId}`);

            // 🔹 2. Envio da mensagem
            const messagePayload = {
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "document",
                document: {
                    id: mediaId,
                    filename: fileName,
                    caption: caption
                }
            };

            const sendResponse = await this.http.post(
                `${this.phoneNumberId}/messages`,
                messagePayload
            );

            if (sendResponse.status !== 200) {
                throw new Error(`Erro ao enviar mensagem: ${JSON.stringify(sendResponse.data)}`);
            }

            console.log(`🎉 PDF enviado com sucesso para ${phoneNumber}`);
            return sendResponse.data;
        } catch (error) {
            console.error("❌ Erro ao enviar o PDF via WhatsApp:", error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = WhatsAppFileSender;
