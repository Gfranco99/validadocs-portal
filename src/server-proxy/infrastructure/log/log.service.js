const fs = require("fs");
const path = require("path");

// const { Client } = require("@elastic/elasticsearch");

// Caminho do log local
const logFilePath = "/app/logs/validadocs.log";
//const logFilePath = "C:\\temp\\validadocs.log";
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// // Cliente Elasticsearch
// const esClient = new Client({
//   node: process.env.ELASTIC_URL || "http://localhost:9200",
//   auth: {
//     username: process.env.ELASTIC_USER || "elastic",
//     password: process.env.ELASTIC_PASS || "changeme"
//   }
// });

// Função para logar
async function logEvent(token, action, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    token,
    action,
    details
  };

  // 1) Salva em arquivo txt
  fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + "\n");

//   // 2) Indexa no Elasticsearch
//   try {
//     await esClient.index({
//       index: "validadocs-logs",
//       document: logEntry
//     });
//   } catch (err) {
//     console.error("Erro ao registrar log no Elasticsearch:", err.message);
//   }
}

module.exports = { logEvent };
