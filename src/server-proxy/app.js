require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const auth = require("./controller/auth.controller");
const { logEvent } = require("./infrastructure/log/log.service");

const app = express();
app.use(express.json());
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.post('/verify', upload.single('file'), async (req, res) => {
  try {
    
    const userId = req.body.userid;
    const filePath = req.file.path;
    const fileStream = fs.createReadStream(filePath);

    const form = new FormData();
    form.append('file', fileStream, req.file.originalname);

    // ATENÇÃO: INSEGURO! Usar apenas para contornar o certificado expirado em desenvolvimento.
    // NUNCA use em produção.
    const httpsAgent = new https.Agent({ // <-- 2. CRIE O AGENTE HTTPS
      rejectUnauthorized: false
    });

    const response = await axios.post(
      `${process.env.API_URL}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Token ${process.env.TOKEN}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 15000,
        httpsAgent: httpsAgent // <-- 3. ADICIONE O AGENTE À CONFIGURAÇÃO DO AXIOS
      }
    );

    // Limpa arquivo temporário
    fs.unlinkSync(filePath);

    // Registra log do evento
    await logEvent(userId, "VERIFY_DOCUMENT", { document: response.data });

    res.json(response.data);

  } catch (error) {
    console.error('URL: ', process.env.API_URL);
    console.error('Erro ao verificar PDF:', error.message);
    res.status(500).json({
      error: 'Erro ao verificar o PDF',
      details: error.message
    });
  }
});

app.post("/create", auth.createCredential);
app.post("/auth", auth.validateCredential);
app.post("/revoke", auth.revokeCredential);

const PORT = process.env.PORT || 3000;

//DEBUG
console.log("Usando as seguintes variáveis de ambiente:");
console.log("PORT:", PORT);
console.log("API_URL:", process.env.API_URL);
console.log("TOKEN:", process.env.TOKEN);
console.log("PG_HOST:", process.env.PG_HOST);
console.log("PG_PORT:", process.env.PG_PORT);
console.log("PG_USER:", process.env.PG_USER);
console.log("PG_PASSWORD:", process.env.PG_PASSWORD ? "********" : "");
console.log("PG_DATABASE:", process.env.PG_DATABASE);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
