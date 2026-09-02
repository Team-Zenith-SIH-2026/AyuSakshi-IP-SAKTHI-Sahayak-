const app = require('./src/app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🌿 AyuSakshi (IP-SAKTI Sahayak) Backend Server`);
  console.log(`  🚀 Running on: http://localhost:${PORT}`);
  console.log(`  🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  ⚖️ SIH26045 - Multilingual Ayurveda IP & RAG Engine`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Gracefully shutting down...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});

module.exports = server;
