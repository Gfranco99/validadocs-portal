// auth.controller.js
const { v4: uuidv4 } = require("uuid");
const pool = require("../infrastructure/db");

// cria token
exports.createCredential = async (req, res) => {
  try {
    const { cliente, expiresIn } = req.body; // em minutos (opcional)

    const token = uuidv4().replace(/-/g, '');;
    const userId = uuidv4().replace(/-/g, '');

    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 60 * 1000); // em minutos
    }

    const result = await pool.query(
      `INSERT INTO validadocscredentials (user_id, cliente, token, created_at, expires_at, is_active) 
       VALUES ($1, $2, $3, NOW(), $4, true) RETURNING *`,
      [userId, cliente, token, expiresAt]
    );

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
    const { token } = req.body;

    const result = await pool.query(
      `SELECT * FROM validadocscredentials 
       WHERE token = $1 AND is_active = true
       LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ success: false, message: "Token inválido ou inativo" });
    }

    const cred = result.rows[0];

    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      return res.status(200).json({ success: false, message: "Token expirado" });
    }

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
