require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.post('/verify', upload.single('file'), async (req, res) => {
  try {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
