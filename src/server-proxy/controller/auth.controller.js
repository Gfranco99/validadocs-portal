// auth.controller.js
const { v4: uuidv4 } = require("uuid");
const pool = require("../infrastructure/data/db");
const { getBrasiliaExpiration, getBrasiliaNow } = require("../helpers/datetime.helper");
const { handleSendNotification } = require("./notification.controller");
const { parseHtmlTemplate } = require("../infrastructure/templates/template.service");
const logDB = require("./log.controller");

// criar token com expiração definida no plano de assinatura
exports.createCredentialWithPlan = async (req, res) => {
  try {
    const { nome, email, documento, telefone, plano } = req.body; // em minutos (opcional)

    //Para plano free, definir expiração padrão de 60 minutos
    let effectiveExpiresIn = 60 * 24 * 30; //fator minutos * horas * dias  - plano free 30 dias
    this.createCredential({ body: { nome, email, documento, telefone, expiresIn: effectiveExpiresIn } }, res);

  } catch (err) {
    console.error("Erro ao criar credencial com expiração do plano:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// criar token com expiração no parametro
exports.createCredential = async (req, res) => {
  try {
    const { nome, email, documento, telefone, expiresIn } = req.body; // em minutos (opcional)

    const token = uuidv4().replace(/-/g, '');;
    const userId = uuidv4().replace(/-/g, '');

    const _date = getBrasiliaExpiration(expiresIn);
    let createdAt = _date.now;

    let expiresAt = null; 
    if (expiresIn) {      
      expiresAt = _date.expires_at;      
    }

    const result = await pool.query(
      `INSERT INTO validadocscredentials (user_id, nome, email, documento, telefone, token, created_at, expires_at, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
      [userId, nome, email, documento, telefone, token, createdAt, expiresAt]
    );
    
    //Notification
    //Prepere email content
    // a.prepara os dados que o template precisa
    const templateData = {
      nome: nome,
      token: token,
      portalUrl: process.env.PORTAL_URL || 'https://apphomol.validadocs.com.br',
    };

    // b.Usa o serviço para gerar o HTML final a partir do template
    const finalHtml = await parseHtmlTemplate('credential-email.html', templateData);

    // c. send email
    await handleSendNotification({
      body: {
        type: 'email',
        payload: {
          to: email,
          subject: 'Sua credencial foi criada',
          html: finalHtml          
      }}}, {
      status: (code) => ({
        json: (data) => console.log('Mock response:', code, data)
      })
    });
    
    res.json({
      success: true,
      credential: result.rows[0]
    });
  } catch (err) {
    console.error("Erro ao criar credencial:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// valida token
exports.validateCredential = async (req, res) => {
  try {
    
    const { token, engine } = req.body;

    const result = await pool.query(
      `SELECT * FROM validadocscredentials 
       WHERE token = $1 AND is_active = true
       LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {      
      const msg = "Token inválido ou inativo";

      // Registra log do evento
      await logDB.logDBValidation(token, "VALIDATE_CREDENTIAL", engine, false, msg );

      return res.status(200).json({ success: false, message: msg });
    }

    const cred = result.rows[0];

    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      const msg = "Token expirado";

      // Registra log do evento
      await logDB.logDBValidation(token, "VALIDATE_CREDENTIAL", engine, false, msg );

      return res.status(200).json({ success: false, message: msg });
    }

    // Registra log do evento
    await logDB.logDBValidation(token, "VALIDATE_CREDENTIAL", engine, true );

    res.json({ success: true, credential: cred });
  } catch (err) {
    console.error("Erro ao validar credencial:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// revogar token
exports.revokeCredential = async (req, res) => {
  try {
    const { token } = req.body;

    const result = await pool.query(
      `SELECT * FROM validadocscredentials 
       WHERE token = $1 AND is_active = true
       LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Token inválido ou inativo" });
    }

    await pool.query(
      `UPDATE validadocscredentials SET is_active = false WHERE token = $1`,
      [token]
    );

    res.json({ success: true, message: "Token revogado com sucesso" });
  } catch (err) {
    console.error("Erro ao revogar token:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// valida Administrador
exports.validateAdministrator = async (req, res) => {
  try {

    const { email, password } = req.body;
    
    const result = await pool.query(
      `SELECT * FROM validadocsUsers 
       WHERE email = $1 AND senha = $2 AND is_active = true
       LIMIT 1`,
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ success: false, message: "Dados de acesso do Admnistrador inválido ou inativo" });
    }
    
    const user = result.rows[0];

    res.json({ success: true, access_token: user.user_id });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Listar credenciais do sistema
exports.listCredentialCollections = async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT
          c.id, c.user_id, c.nome, c.email, c.documento, c.telefone, c.token, 
          c.is_active, c.created_at, c.expires_at,
          COUNT(l.id) AS validation_count
        FROM
          validadocscredentials c
        LEFT JOIN
          validadocslogs l ON c.token = l.token
        GROUP BY
          c.id
        ORDER BY
          c.created_at DESC`    
    );

    res.json({ success: true, credentials: result.rows });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};