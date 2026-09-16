require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const config = require('./src/config/constants');
const connectDB = require('./src/config/db');
const apiRoutes = require('./src/routes/index');

const app = express();

// Ensure storage dirs exist
fs.mkdirSync(path.join(config.STORAGE_DIR, 'photos'), { recursive: true });
fs.mkdirSync(path.join(config.STORAGE_DIR, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(config.STORAGE_DIR, 'qr'), { recursive: true });

// Explicit CORS middleware: reflect the request origin when it matches an
// allowed frontend domain (Vercel production + local dev), set the CORS
// headers, and answer OPTIONS preflight requests with HTTP 204 so browsers can
// call the JSON API (e.g. POST /api/auth/send-otp). Requests without an Origin
// header (curl, health checks) pass through untouched.
const ALLOWED_ORIGINS = ['https://aiswarya-online1.vercel.app', 'http://localhost:5173'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
    });
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
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