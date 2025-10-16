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
const logDB = require("./controller/log.controller");
const { logEvent } = require("./infrastructure/log/log.service");

const app = express();
app.use(express.json());
app.use(cors());

const Engine = {
  ITI: 'ITI',
  SDK: 'SDK'
};

let apiEngineValidation = process.env.API_URL_ITI; // Padrão para 'ITI'

const upload = multer({ dest: 'uploads/' });

let userId = null;

app.post('/verify', upload.single('file'), async (req, res) => {
  try {
    
    userId = req.body.userid;
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const engine = req.body.engine || Engine.ITI; // Padrão para 'ITI' se não fornecido
    if(engine !== Engine.ITI && engine !== Engine.SDK){
      engine = Engine.ITI; // Força para 'ITI' se valor inválido
    }
    apiEngineValidation = engine === Engine.ITI ? process.env.API_URL_ITI : process.env.API_URL_SDK;

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
      apiEngineValidation,
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
    //BD
    await logDB.logDBValidation(userId, engine, response.data.isValid );
    //File
    await logEvent(userId, "VERIFY_DOCUMENT", { document: response.data });

    res.json(response.data);

  } catch (error) {
    console.error('Core de validação: ', apiEngineValidation);
    console.error('Erro ao verificar PDF:', error.message);

    //File
    await logEvent(userId, "ERROR", { engine: apiEngineValidation, error: error.message });

    res.status(500).json({
      error: 'Erro ao verificar o PDF',
      details: error.message
    });
  }
});

app.post("/create", auth.createCredential);
app.post("/auth", auth.validateCredential);
app.post("/revoke", auth.revokeCredential);
app.post("/login", auth.validateAdministrator);
app.post("/getAllCredentials", auth.listCredentialCollections);

const PORT = process.env.PORT || 3000;

//DEBUG
console.log("Usando as seguintes variáveis de ambiente:");
console.log("PORT:", PORT);
console.log("API_URL:", apiEngineValidation);
console.log("TOKEN:", process.env.TOKEN);
console.log("PG_HOST:", process.env.PG_HOST);
console.log("PG_PORT:", process.env.PG_PORT);
console.log("PG_USER:", process.env.PG_USER);
console.log("PG_PASSWORD:", process.env.PG_PASSWORD ? "********" : "");
console.log("PG_DATABASE:", process.env.PG_DATABASE);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
