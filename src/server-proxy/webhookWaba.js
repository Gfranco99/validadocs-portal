const express = require('express');
const axios = require('axios');

const router = express.Router();

// ⚠️ Aqui está o SEU token da Cloud API do WhatsApp Business
const ACCESS_TOKEN = "EAASbZAPSIdqwBPLMPXAtaBIcWBOm29MXzDDZBUZAFqFcMBKODpIzzh00O2OtSCOWSHbsed00zWYOcwuZCUxi8ZCFVBepk1XvCzJHY4y2KAn1P8dZCu5t7L3lgBPHhs80DGlZCy2Dpigg2UFRYDMhLZB2tYeZBIvFfSuaZA8rYZAKWwufZAtwZBXu9xlk4gv5B6uwChf59xwZDZD";

// ⚠️ Opcional: você pode mudar esse texto, mas tem que ser o mesmo no Meta Developer
const VERIFY_TOKEN = "MEU_TOKEN_VERIFICACAO";

/**
 * Verificação do token para configurar o webhook (GET)
 * Necessário somente 1 vez ao configurar no Meta Developer
 */
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("🟢 Webhook verificado com sucesso!");
        res.status(200).send(challenge);
    } else {
        console.log("🔴 Falha ao verificar webhook");
        res.sendStatus(403);
    }
});

/**
 * Recebimento de mensagens (POST)
 */
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.entry && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from; // Telefone do remetente
            console.log("📩 Mensagem recebida de:", from);

            if (message.type === "document") {
                // 📎 Temos um documento (ex: PDF)
                const mediaId = message.document.id;
                const fileName = message.document.filename || "documento.pdf";
                console.log(`📎 Documento recebido: ${fileName} (ID: ${mediaId})`);

                // 🔽 1. Obter link de download
                const mediaUrlResponse = await axios.get(
                    `https://graph.facebook.com/v19.0/${mediaId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${ACCESS_TOKEN}`
                        }
                    }
                );

                const fileUrl = mediaUrlResponse.data.url;
                console.log("🔗 URL para download:", fileUrl);

                // ⬇ 2. Baixar arquivo (pode salvar/armazenar/usar buffer)
                const fileResponse = await axios.get(fileUrl, {
                    responseType: "arraybuffer",
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
                });

                const pdfBuffer = fileResponse.data; // <–– BUFFER do PDF enviado!

                // ▶ Aqui você chama sua função de análise (ValidaDocs)
                // const pdfProcessado = await executarAnalise(pdfBuffer);
                // await sendProcessedPdf(from, pdfProcessado);

                // 📨 3. Responder automaticamente
                await sendWhatsAppText(from, `Recebemos o documento "${fileName}". Iniciando análise.`);
            } else {
                console.log("ℹ Mensagem recebida não é arquivo. Tipo:", message.type);
                await sendWhatsAppText(from, "Envie um arquivo PDF para processarmos.");
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Erro ao processar webhook:", err.response?.data || err.message);
        res.sendStatus(500);
    }
});

/**
 * Passo 3 – MENSAGEM DE TEXTO
 * Função para responder ao contato
 */
async function sendWhatsAppText(to, message) {
    try {
        await axios.post(
            // ⚠️ AQUI já está o seu phoneNumberId
            `https://graph.facebook.com/v19.0/706070805928402/messages`,
            {
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: message }
            },
            { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
        );

        console.log(`📤 Mensagem enviada para ${to}: "${message}"`);
    } catch (err) {
        console.error("❌ Erro ao enviar resposta:", err.response?.data || err.message);
    }
}

module.exports = router;