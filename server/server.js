require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const config = require('./src/config/constants');
const connectDB = require('./src/config/db');
const apiRoutes = require('./src/routes/index');

const app = express();

// Refuse to start a production server that is missing its security
// configuration. Every one of these is fail-closed at request time as well;
// this turns a silent lockout (or, worse, a guessed default) into a loud
// startup failure instead.
if (config.NODE_ENV === 'production') {
  const problems = [];
  if (!config.JWT_SECRET || config.JWT_SECRET === 'dev-secret-change-me') {
    problems.push('JWT_SECRET must be set to a strong random value');
  }
  if (!config.SUPER_ADMIN_PHONES.length) {
    problems.push('SUPER_ADMIN_PHONES must list at least one authority phone');
  }
  if (problems.length) {
    console.error('[FATAL] Refusing to start with an incomplete production config:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

// Ensure storage dirs exist
fs.mkdirSync(path.join(config.STORAGE_DIR, 'photos'), { recursive: true });
fs.mkdirSync(path.join(config.STORAGE_DIR, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(config.STORAGE_DIR, 'qr'), { recursive: true });

// Explicit CORS middleware: reflect the request origin when it matches an
// allowed frontend domain (Vercel production + local dev), set the CORS
// headers, and answer OPTIONS preflight requests with HTTP 204 so browsers can
// call the JSON API (e.g. POST /api/auth/login). Requests without an Origin
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
    console.log(`[STORAGE] ${config.STORAGE_DIR}`);
    // Photos are stored on local disk unless an ImgBB key is configured. On a
    // host with an ephemeral filesystem (Render, most container platforms) every
    // redeploy or restart wipes that disk while MongoDB keeps the album records,
    // so the gallery fills up with albums whose images all 404. Warn loudly
    // rather than let an officer discover it after uploading their photos.
    if (config.NODE_ENV === 'production' && !config.IMG_BB_API_KEY) {
      console.warn(
        '[STORAGE] WARNING: IMG_BB_API_KEY is not set, so uploaded photos are ' +
          'written to local disk (' + config.STORAGE_DIR + '). If this host has an ' +
          'ephemeral filesystem, photos uploaded before a restart will be missing ' +
          'from the gallery. Set IMG_BB_API_KEY to host them durably.'
      );
    }
    if (config.NODE_ENV !== 'production') {
      // A bcrypt cost above the default makes local logins feel slow and buries
      // real hashing time in dev. Say so rather than letting a developer blame
      // the auth code for it.
      if (config.PASSWORD.saltRounds > 12) {
        console.warn(
          `[AUTH] BCRYPT_SALT_ROUNDS is ${config.PASSWORD.saltRounds}. Registration ` +
            'and login will be noticeably slower than the default of 12.'
        );
      }
    }
  });
});

module.exports = app;