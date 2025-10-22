const pool = require("../infrastructure/data/db");

// cria token
exports.logDBValidation = async (token, action, engine, validation_status, message) => {
  try {
    const result = await pool.query(
      `INSERT INTO validadocslogs (token, action, engine, validation_status, message) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [token, action, engine, validation_status, message]
    );    
  } catch (err) {
    console.error("Erro ao criar registrar log:", err);
  }
};