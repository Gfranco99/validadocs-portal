const { v4: uuidv4 } = require("uuid");
const pool = require("../infrastructure/data/db");
const { getBrasiliaExpiration, getBrasiliaNow } = require("../helpers/datetime.helper");
const { handleSendNotification } = require("./notification.controller");
const { parseHtmlTemplate } = require("../infrastructure/templates/template.service");
const logDB = require("./log.controller");

// Cria credencial usando um plano pré-definido (ex: plano free = 30 dias)
exports.createCredentialWithPlan = async (req, res) => {
  try {
    const { nome, email, documento, telefone, plano } = req.body;

    const effectiveExpiresIn = 60 * 24 * 30; // minutos (30 dias)

    return exports.createCredential(
      {
        body: {
          nome,
          email,
          documento,
          telefone,
          expiresIn: effectiveExpiresIn,
        },
      },
      res
    );
  } catch (err) {
    console.error("Erro ao criar credencial com expiração do plano:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Cria credencial (token) e trata revogação dos anteriores
exports.createCredential = async (req, res) => {
  try {
    const { nome, email, documento, telefone, expiresIn } = req.body; // expiresIn em minutos

    const token = uuidv4().replace(/-/g, "");
    const userId = uuidv4().replace(/-/g, "");

    // Datas geradas com base no fuso configurado (Brasília)
    const { now, expires_at } = getBrasiliaExpiration(expiresIn);
    const createdAt = now;
    const expiresAt = expiresIn ? expires_at : null;

    // Referência de "agora"
    const nowBr = getBrasiliaNow ? getBrasiliaNow() : new Date();

    // IMPORTANTE:
    // Aqui desativamos somente tokens temporários (aqueles com expires_at definido)
    // que ainda estão válidos. Tokens permanentes (expires_at IS NULL) NÃO são desativados.
    await pool.query(
      `
      UPDATE validadocscredentials
      SET is_active = false
      WHERE email = $1
        AND is_active = true
        AND expires_at IS NOT NULL
        AND expires_at > $2
      `,
      [email, nowBr]
    );

    // Cria o novo token ativo
    const insertResult = await pool.query(
      `
      INSERT INTO validadocscredentials (
        user_id,
        nome,
        email,
        documento,
        telefone,
        token,
        created_at,
        expires_at,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
      RETURNING *
      `,
      [userId, nome, email, documento, telefone, token, createdAt, expiresAt]
    );

    // Envia notificação com o token
    const templateData = {
      nome: nome,
      token: token,
      portalUrl: process.env.PORTAL_URL || "https://apphomol.validadocs.com.br",
    };

    const finalHtml = await parseHtmlTemplate("credential-email.html", templateData);

    await handleSendNotification(
      {
        body: {
          type: "email",
          payload: {
            to: email,
            subject: "Sua credencial foi criada",
            html: finalHtml,
          },
        },
      },
      {
        status: (code) => ({
          json: (data) => console.log("Mock response:", code, data),
        }),
      }
    );

    return res.json({
      success: true,
      credential: insertResult.rows[0],
    });
  } catch (err) {
    console.error("Erro ao criar credencial:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Valida se um token pode ser usado
exports.validateCredential = async (req, res) => {
  try {
    const { token, engine } = req.body;

    const result = await pool.query(
      `
      SELECT *
      FROM validadocscredentials
      WHERE token = $1
        AND is_active = true
      LIMIT 1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      const msg = "Token inválido ou inativo";

      await logDB.logDBValidation(token, "VALIDATE_CREDENTIAL", engine, false, msg);

      return res.status(200).json({ success: false, message: msg });
    }

    const cred = result.rows[0];

    // Se tem data de expiração e já passou, bloqueia
    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      const msg = "Token expirado";

      await logDB.logDBValidation(token, "VALIDATE_CREDENTIAL", engine, false, msg);

      return res.status(200).json({ success: false, message: msg });
    }

    await logDB.logDBValidation(token, "VALIDATE_CREDENTIAL", engine, true);

    return res.json({ success: true, credential: cred });
  } catch (err) {
    console.error("Erro ao validar credencial:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Revoga um token específico manualmente
exports.revokeCredential = async (req, res) => {
  try {
    const { token } = req.body;

    const result = await pool.query(
      `
      SELECT *
      FROM validadocscredentials
      WHERE token = $1
        AND is_active = true
      LIMIT 1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Token inválido ou inativo" });
    }

    await pool.query(
      `
      UPDATE validadocscredentials
      SET is_active = false
      WHERE token = $1
      `,
      [token]
    );

    return res.json({ success: true, message: "Token revogado com sucesso" });
  } catch (err) {
    console.error("Erro ao revogar token:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Login de administrador
exports.validateAdministrator = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
      SELECT *
      FROM validadocsUsers
      WHERE email = $1
        AND senha = $2
        AND is_active = true
      LIMIT 1
      `,
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: false,
        message: "Dados de acesso do Admnistrador inválido ou inativo",
      });
    }

    const user = result.rows[0];

    return res.json({ success: true, access_token: user.user_id });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Lista as credenciais + contador de validações
exports.listCredentialCollections = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.user_id,
        c.nome,
        c.email,
        c.documento,
        c.telefone,
        c.token,
        c.is_active,
        c.created_at,
        c.expires_at,
        COUNT(l.id) AS validation_count
      FROM validadocscredentials c
      LEFT JOIN validadocslogs l
        ON c.token = l.token
      GROUP BY c.id
      ORDER BY c.created_at DESC
      `
    );

    return res.json({ success: true, credentials: result.rows });
  } catch (err) {
    console.error("Erro ao listar credenciais:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
