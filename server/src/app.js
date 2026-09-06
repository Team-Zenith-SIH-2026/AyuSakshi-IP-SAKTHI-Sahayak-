const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const passport = require('./config/passport');

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');
const escalationRoutes = require('./routes/escalationRoutes');
const classificationRoutes = require('./routes/classificationRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// Ensure upload directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Security & Utility Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(passport.initialize());

// Serve static uploaded documents
app.use('/uploads', express.static(uploadDir));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/formulations', classificationRoutes);
app.use('/', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    app: 'AyuSakshi (IP-SAKTI Sahayak) API Backend',
    version: '1.0.0',
    description: 'SIH26045: Multilingual RAG Platform for Ayurveda IP & Regulatory Intelligence',
    jurisdictions_supported: ['india', 'international'],
    status: 'online',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route '${req.originalUrl}' not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global App Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : err.message,
  });
});

module.exports = app;
