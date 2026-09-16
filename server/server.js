require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./src/config/constants');
const connectDB = require('./src/config/db');
const apiRoutes = require('./src/routes/index');

const app = express();

// Ensure storage dirs exist
fs.mkdirSync(path.join(config.STORAGE_DIR, 'photos'), { recursive: true });
fs.mkdirSync(path.join(config.STORAGE_DIR, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(config.STORAGE_DIR, 'qr'), { recursive: true });

// CORS: allow the configured frontend origins (localhost for development plus
// the production Vercel URL) with credentials, and answer OPTIONS preflight
// requests so browsers can call the JSON API. Non-browser requests (curl,
// health checks) have no Origin header and therefore pass.
const ALLOWED_ORIGIN_SUFFIXES = ['.vercel.app', '.onrender.com'];

function isOriginAllowed(origin) {
  if (config.CLIENT_URLS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      ALLOWED_ORIGIN_SUFFIXES.some((suffix) => host.endsWith(suffix))
    );
  } catch (e) {
    return false;
  }
}

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || isOriginAllowed(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
  preflightContinue: false,
};
app.use(cors(corsOptions));
// Explicit OPTIONS handler for CORS preflight requests (browsers send these
// before POST /api/auth/send-otp when cross-origin + JSON is used).
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve generated documents
app.use('/uploads', express.static(path.join(config.STORAGE_DIR)));

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', club: config.CLUB.name, regNo: config.CLUB.regNo });
});

// Serve client build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

connectDB().then(() => {
  app.listen(config.PORT, () => {
    console.log(
      `[${config.CLUB.name}] Server running on http://localhost:${config.PORT}`
    );
    console.log(`[CORS] Allowed origins: ${config.CLIENT_URLS.join(', ')}`);
    if (config.NODE_ENV !== 'production') {
      console.log('[DEV MODE] SMS delivery disabled – OTPs appear in the logs.');
    }
  });
});

module.exports = app;