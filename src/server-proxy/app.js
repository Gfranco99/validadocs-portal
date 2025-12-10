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

/**
 * Busca a descrição completa de erro pelo ID retornado no JSON
 * URL base: https://homol2.validadocs.com.br/api/ErrorsMapping/id/{id}
 * Prioridade:
 *  1) userInstructionsPTBR
 *  2) description
 *  3) errorMessage
 */
async function getErrorDescriptionById(id) {
  if (id === undefined || id === null || id === '') return null;

  try {
    const url = `https://homol2.validadocs.com.br/api/ErrorsMapping/id/${id}`;

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false // homol2 com certificado problemático em homol
    });

    console.log("|Õ| Buscando descrição de erro para ID:", id);

    const res = await axios.get(url, {
      httpsAgent,
      timeout: 15000,
      headers: {
        Authorization: `Token ${process.env.TOKEN}`,
      },
    });

    const data = res.data || {};

    return (
      data.userInstructionsPTBR ||
      data.description ||
      data.errorMessage ||
      null
    );
  } catch (err) {
    console.error('Erro ao buscar descrição do erro (ErrorsMapping/id):', id, err.message);
    return null; // não quebra o fluxo se der erro aqui
  }
}

/**
 * Extrai todos os IDs de signatureAlerts do retorno da engine
 * (digitalSignatureValidations[*].signatureAlerts[*].id)
 * Hoje não está sendo usado diretamente, mas mantido caso precise no futuro.
 */
function collectSignatureAlertIds(engineData) {
  const vdr = engineData?.validaDocsReturn;
  const sigs = Array.isArray(vdr?.digitalSignatureValidations)
    ? vdr.digitalSignatureValidations
    : [];

  const ids = new Set();

  for (const s of sigs) {
    if (!s) continue;
    const alerts = s.signatureAlerts;
    if (!alerts) continue;

    const arr = Array.isArray(alerts) ? alerts : [alerts];
    for (const a of arr) {
      if (a && a.id) {
        ids.add(String(a.id));
      }
    }
  }

  return Array.from(ids);
}

/**
 * Mapa local de códigos -> explicações amigáveis
 * (Mantido como fallback, mas o front NÃO usa mais isso)
 */
const ERROR_CODE_MAP = {
  ForbiddenSignedAttributePresent:
    'O documento contém um atributo assinado que é proibido pelas regras da política de assinatura. ' +
    'Em geral, isso indica que o documento foi assinado com alguma informação adicional não permitida, ' +
    'o que pode impactar a conformidade, mesmo que a assinatura seja criptograficamente válida.'
};

// ===================================================================
// ROTA PRINCIPAL /verify
// ===================================================================
app.post('/verify', upload.single('file'), async (req, res) => {
  try {
    userId = req.body.userid;
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    let engine = req.body.engine || Engine.ITI; // Padrão para 'ITI'
    if (engine !== Engine.ITI && engine !== Engine.SDK) {
      engine = Engine.ITI;
    }
    apiEngineValidation = engine === Engine.ITI ? process.env.API_URL_ITI : process.env.API_URL_SDK;

    const filePath = req.file.path;
    const fileStream = fs.createReadStream(filePath);

    const form = new FormData();
    form.append('file', fileStream, req.file.originalname);
    form.append('language', 'pt-BR');

    const httpsAgent = new https.Agent({
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
        httpsAgent: httpsAgent
      }
    );

    // Limpa arquivo temporário
    fs.unlinkSync(filePath);

    // ---------- APENAS RETORNA O JSON DA ENGINE ----------
    const engineData = response.data || {};

    // Registra log do evento
    await logDB.logDBValidation(userId, "VERIFY_DOCUMENT", engine, engineData.isValid);
    await logEvent(userId, "VERIFY_DOCUMENT", { document: engineData });

    res.json(engineData);

  } catch (error) {
    console.error('Core de validação: ', apiEngineValidation);
    console.error('Erro ao verificar PDF:', error.message);

    try {
      await logEvent(userId, "ERROR", { engine: apiEngineValidation, error: error.message });
    } catch (e) {
      console.error("Falha ao registrar log de erro:", e.message);
    }

    res.status(500).json({
      error: 'Erro ao verificar o PDF',
      details: error.message
    });
  }
});

// ===================================================================
// NOVA ROTA: descrição detalhada de erro por ID
// ===================================================================
app.get('/errorDescription/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetro id é obrigatório'
    });
  }

  try {
    const desc = await getErrorDescriptionById(id);

    if (!desc) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma descrição encontrada para este ID'
      });
    }

    return res.json({
      success: true,
      description: String(desc).trim()
    });
  } catch (err) {
    console.error('Erro na rota /errorDescription:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar a descrição do erro'
    });
  }
});

// ===================================================================
// OUTRAS ROTAS (sem alterações)
// ===================================================================

app.post("/createPlan", auth.createCredentialWithPlan);
app.post("/create", auth.createCredential);
app.post("/auth", auth.validateCredential);
app.post("/revoke", auth.revokeCredential);
app.post("/login", auth.validateAdministrator);
app.post("/getAllCredentials", auth.listCredentialCollections);
app.post("/notification", auth.sendNotification);

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
