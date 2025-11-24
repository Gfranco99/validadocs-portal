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
  if (!id && id !== 0) return null;

  try {
    const url = `https://homol2.validadocs.com.br/api/ErrorsMapping/id/${id}`;

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false // homol2 com certificado problemático em homol, OK
    });

    const res = await axios.get(url, {
      httpsAgent,
      timeout: 15000
    });

    const data = res.data || {};

    return (
      data.userInstructionsPTBR ||
      data.description ||
      data.errorMessage ||
      null
    );
  } catch (err) {
    console.error('Erro ao buscar descrição do erro (ErrorsMapping/id):', err.message);
    return null; // não quebra o fluxo de validação se der erro aqui
  }
}

/**
 * Mapa local de códigos -> explicações amigáveis
 * (Você pode ir alimentando isso com os códigos que mais aparecem)
 */
const ERROR_CODE_MAP = {
  ForbiddenSignedAttributePresent:
    'O documento contém um atributo assinado que é proibido pelas regras da política de assinatura. ' +
    'Em geral, isso indica que o documento foi assinado com alguma informação adicional não permitida, ' +
    'o que pode impactar a conformidade, mesmo que a assinatura seja criptograficamente válida.'
  // Exemplo de como adicionar mais:
  // SomeOtherCode: 'Explicação amigável para o código SomeOtherCode...'
};

/**
 * Monta uma lista de mensagens “amigáveis” baseadas no retorno da engine
 * - Usa fullErrorMessage se existir
 * - Junta alerts/errors das assinaturas
 * - Junta alerts/errors do PDF/A
 */
function buildFriendlyMessages(engineData) {
  const msgs = [];

  // 1) Mensagem longa mapeada (se existir)
  if (engineData.fullErrorMessage) {
    msgs.push(String(engineData.fullErrorMessage).trim());
  } else if (engineData.validaDocsReturn?.fullErrorMessage) {
    msgs.push(String(engineData.validaDocsReturn.fullErrorMessage).trim());
  }

  const vdr = engineData.validaDocsReturn || {};

  // 2) Alerts/Errors das assinaturas
  const sigs = Array.isArray(vdr.digitalSignatureValidations)
    ? vdr.digitalSignatureValidations
    : [];

  for (const s of sigs) {
    // signatureErrors
    if (s.signatureErrors) {
      const arr = Array.isArray(s.signatureErrors)
        ? s.signatureErrors
        : [s.signatureErrors];

      for (const entry of arr) {
        if (!entry) continue;

        if (typeof entry === 'string') {
          const txt = entry.trim();
          if (txt) msgs.push(txt);
        } else if (typeof entry === 'object') {
          const desc =
            (entry.description && String(entry.description).trim()) ||
            (entry.message && String(entry.message).trim());

          if (desc) msgs.push(desc);
        }
      }
    }

    // signatureAlerts
    if (s.signatureAlerts) {
      const arr = Array.isArray(s.signatureAlerts)
        ? s.signatureAlerts
        : [s.signatureAlerts];

      for (const entry of arr) {
        if (!entry) continue;

        const code = entry.id || entry.code;
        const desc = entry.description || entry.message;

        // Texto que vem da engine
        if (desc) {
          const txt = String(desc).trim();
          if (txt) msgs.push(txt);
        }

        // Texto extra que vem do nosso mapa interno
        if (code && ERROR_CODE_MAP[code]) {
          msgs.push(ERROR_CODE_MAP[code]);
        }
      }
    }
  }

  // 3) PDF/A alerts/errors
  const pdf = vdr.pdfValidations || {};
  if (pdf.alertMessage) {
    const txt = String(pdf.alertMessage).trim();
    if (txt) msgs.push(txt);
  }
  if (pdf.errorMessage) {
    const txt = String(pdf.errorMessage).trim();
    if (txt) msgs.push(txt);
  }

  // Remove duplicadas e vazias
  const clean = Array.from(
    new Set(
      msgs
        .map(m => m.trim())
        .filter(m => m && m !== '[object Object]')
    )
  );

  return clean;
}

app.post('/verify', upload.single('file'), async (req, res) => {
  try {
    userId = req.body.userid;
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    let engine = req.body.engine || Engine.ITI; // Padrão para 'ITI' se não fornecido
    if (engine !== Engine.ITI && engine !== Engine.SDK) {
      engine = Engine.ITI; // Força para 'ITI' se valor inválido
    }
    apiEngineValidation = engine === Engine.ITI ? process.env.API_URL_ITI : process.env.API_URL_SDK;

    const filePath = req.file.path;
    const fileStream = fs.createReadStream(filePath);

    const form = new FormData();
    form.append('file', fileStream, req.file.originalname);
    form.append('language', 'pt-BR');

    // ATENÇÃO: INSEGURO! Usar apenas para contornar o certificado expirado em desenvolvimento.
    // NUNCA use em produção.
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

    // ---------- ENRIQUECER COM DESCRIÇÃO E MENSAGENS AMIGÁVEIS ----------
    const engineData = response.data || {};

    // Tentamos achar o ID do erro em diferentes lugares
    const rootErrorId =
      engineData.errorMessageId ??
      engineData.errorId ??
      engineData.errorCode;

    const nestedErrorId =
      engineData?.validaDocsReturn?.errorMessageId ??
      engineData?.validaDocsReturn?.errorId ??
      engineData?.validaDocsReturn?.errorCode;

    const errorIdToLookup = nestedErrorId ?? rootErrorId;

    if (errorIdToLookup !== undefined && errorIdToLookup !== null) {
      const fullDescription = await getErrorDescriptionById(errorIdToLookup);
      if (fullDescription) {
        // adiciona direto no objeto de retorno
        engineData.fullErrorMessage = fullDescription;

        // se tiver bloco validaDocsReturn, também pode anexar lá
        if (!engineData.validaDocsReturn) {
          engineData.validaDocsReturn = {};
        }
        engineData.validaDocsReturn.fullErrorMessage = fullDescription;
      }
    }

    // Monta friendlyMessages (lista de textos explicativos)
    const friendlyMessages = buildFriendlyMessages(engineData);
    if (friendlyMessages.length) {
      engineData.friendlyMessages = friendlyMessages;
    }
    // --------------------------------------------------------

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

/**
 * ENDPOINT EXISTENTE:
 * Proxy para o mapeamento de todos os erros da engine
 * Front chama: GET /errors-mapping
 */
// app.get('/errors-mapping', async (req, res) => {
//   try {
//     const httpsAgent = new https.Agent({
//       rejectUnauthorized: false // se o homol2 tiver problema de certificado
//     });

//     const response = await axios.get(
//       'https://homol2.validadocs.com.br/api/ErrorsMapping/all',
//       {
//         httpsAgent,
//         timeout: 15000
//       }
//     );

//     res.json(response.data);
//   } catch (error) {
//     console.error('Erro ao buscar ErrorsMapping:', error.message);
//     res.status(500).json({
//       error: 'Erro ao buscar mapeamento de erros',
//       details: error.message
//     });
//   }
// });

app.post("/createPlan", auth.createCredentialWithPlan);
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