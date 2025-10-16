const pool = require("../infrastructure/data/db");

// cria token
exports.logDBValidation = async (token, engine, validation_status) => {
  try {
    const result = await pool.query(
      `INSERT INTO validadocslogs (token, engine, validation_status) 
       VALUES ($1, $2, $3) RETURNING *`,
      [token, engine, validation_status]
    );    
  } catch (err) {
    console.error("Erro ao criar registrar log:", err);
  }
};