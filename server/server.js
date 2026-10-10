require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./src/config/constants');
const connectDB = require('./src/config/db');
const { resyncDesignationRoles } = require('./src/services/roleService');
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

// Trust exactly one proxy hop. In production the app sits behind Render's proxy,
// so without this every request would appear to come from the proxy's own IP and
// per-IP rate limiting would throttle the whole club at once - one member's
// mistyped password locking out everyone in the hall. Exactly one hop, so a
// client cannot forge X-Forwarded-For to slip the limiter.
app.set('trust proxy', 1);

// Security response headers via helmet. The defaults are close to what we want;
// the deltas below exist so hardening does not break the app:
//
//  - Content-Security-Policy is spelled out because this service serves the
//    built SPA (index.html + hashed JS/CSS) and loads Google Fonts. 'unsafe-
//    inline' is allowed for styles only (React inline style attributes /
//    Tailwind), never for scripts. connect-src carries the allowed API origins
//    so the separately-hosted frontend can still call this API.
//  - crossOriginResourcePolicy is set to 'cross-origin' so /uploads images are
//    not blocked when the frontend is served from a different origin (Vercel).
//  - upgrade-insecure-requests is disabled outside production, or it would
//    rewrite http://localhost to https:// and break local development.
const connectOrigins = Array.from(
  new Set(
    [...config.CLIENT_URLS, config.PUBLIC_API_URL]
      .map((o) => String(o || '').trim().replace(/\/+$/, ''))
      .filter(Boolean)
  )
);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", ...connectOrigins],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// CORS, via the cors package (already a dependency). It reflects the request
// origin when it matches an allowed frontend domain, sets the CORS headers, and
// answers OPTIONS preflight requests with HTTP 204 so browsers can call the JSON
// API (e.g. POST /api/auth/login). Requests without an Origin header (curl,
// health checks) pass through untouched.
//
// The allowlist comes from config.CLIENT_URLS (built-in defaults + the
// CLIENT_URLS/CLIENT_URL env vars) rather than a literal here. This used to be
// a hardcoded array of just the Vercel host and localhost, so the documented
// CLIENT_URLS variable had no effect at all: pointing a new domain - the club's
// custom domain, say - at the API produced responses with NO
// Access-Control-Allow-Origin header and the browser silently discarded every
// one of them. The page loaded and then showed no data, which reads as "assets
// 404 under the custom domain" but is really a blocked API response. Adding a
// domain must be a matter of setting CLIENT_URLS on the host, not editing code.
const ALLOWED_ORIGINS = new Set(
  [...config.CLIENT_URLS, `http://localhost:${config.PORT}`]
    .map((o) => String(o).trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

// The origin this request was actually addressed to, e.g.
// https://club.example from the Host / X-Forwarded-Proto headers Render's proxy
// sets. A deployment that serves the built client AND the API from one host
// (what a custom domain mapped to this service gives you) is same-origin, so
// CORS never applies to it - but browsers still send an Origin header, and
// without this the custom domain would have to be repeated in CLIENT_URLS to
// keep working. Matching Origin against our own Host cannot widen access: the
// caller already controls that host, and auth is a Bearer token in
// localStorage rather than a cookie, so there is nothing for a reflected
// credentialed origin to steal.
function selfOrigin(req) {
  const proto = req.headers['x-forwarded-proto'];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return '';
  // trust proxy is 1, so X-Forwarded-Proto is a single value from our own proxy.
  const scheme = String(proto || req.protocol || '').split(',')[0].trim();
  return scheme ? `${scheme}://${String(host).split(',')[0].trim()}` : '';
}

// cors accepts either options or a function (req, cb) => cb(null, options), and
// only the delegating form sees the request. That matters here: deciding whether
// an origin is allowed needs the Host / X-Forwarded-* headers (selfOrigin), and
// cors's own `origin` callback is invoked with just the origin string - no req.
// So the per-request check runs out here and its verdict is handed to cors.
//
// The verdict is passed as a FUNCTION, never as a boolean. cors treats a falsy
// `origin` option as "allow anything" and emits `Access-Control-Allow-Origin: *`,
// so returning `origin: false` for a disallowed request - the obvious way to
// say "no headers for this one" - would instead reflect a wildcard to everyone,
// which is the opposite of the intent. The function form yields a genuine
// allow/deny: denied requests come back with no ACAO header at all and the
// browser blocks them, which is what we want.
app.use(
  cors((req, cb) => {
    const origin = req.headers.origin;
    const normalized = origin ? String(origin).trim().replace(/\/+$/, '') : '';
    const allowed = Boolean(normalized) && (ALLOWED_ORIGINS.has(normalized) || normalized === selfOrigin(req));
    cb(null, {
      // Re-checked against the origin cors hands back so the grant is tied to the
      // origin actually present on this request, not to a value captured earlier.
      origin: (o, done) => done(null, allowed && String(o).replace(/\/+$/, '') === normalized),
      // Needed for cookies and Authorization-bearing requests. Paired with a
      // specific (never '*') ACAO, which is what this origin allowlist guarantees.
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // Keep the client's two headers explicit. cors would otherwise reflect
      // Access-Control-Request-Headers, which lets any caller add one.
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204,
      // A preflight for a disallowed origin still gets 204 - refusing the
      // preflight outright is a needless extra round trip, and the real request
      // is still blocked by the missing ACAO header above.
    });
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve generated documents. config.STORAGE_DIR is already resolved to an
// absolute path (see config/constants.js), so this mount reads and writes the
// same directory no matter which folder the process was launched from.
app.use('/uploads', express.static(config.STORAGE_DIR, { fallthrough: true, index: false }));

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', club: config.CLUB.name, regNo: config.CLUB.regNo });
});

// Serve the client build. index.html references its JS/CSS with absolute paths
// ("/assets/index-<hash>.js"), which resolve against the ORIGIN, not the current
// directory - correct for the app served at the root of any host, whether that
// is the .onrender.com URL or a custom domain mapped to this service. There is
// therefore nothing domain-specific to change here; a 404 on /assets/* means the
// directory below is missing, not that the paths are wrong.
//
// client/dist is gitignored (see client/.gitignore), so it exists on a host only
// if that host's build command runs the client build. A Render service that
// installs and starts the API but never builds the client is the single most
// common cause of "the custom domain 404s": the API answers /api/* perfectly
// while every other path falls through to Express's bare "Cannot GET /".
const clientDist = config.CLIENT_DIST_DIR;
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  // Hashed filenames under /assets can be cached forever; index.html must not
  // be, or a browser keeps loading the previous build's asset names after a
  // redeploy.
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders(res, filePath) {
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    // sendFile does not go through express.static, so it needs the header again:
    // a cached index.html keeps pointing at asset hashes from an old build and
    // the app 404s on its own JS after a redeploy.
    res.sendFile(path.join(clientDist, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
} else {
  // Previously this whole block was skipped silently, so a build that never
  // produced the client bundle served Express's plain HTML 404 for /assets/* and
  // for the app itself, with nothing in the logs and nothing in the response to
  // explain it. Answer with a diagnosis instead, so the difference between "the
  // custom domain is not mapped to this service" and "this service has no
  // frontend" is visible to whoever is looking at a blank page.
  console.warn(
    `[STATIC] No client build at ${clientDist} - only the API will respond, and ` +
      'every other path returns 503. Build the client (npm --prefix client ci && ' +
      'npm --prefix client run build), set Render\'s Root Directory to the repo ' +
      'root so client/dist exists at startup, or point CLIENT_DIST_DIR at the ' +
      'directory your build actually writes.'
  );
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res
      .status(503)
      .type('text/plain')
      .send(
        'The API is running but this server has no client build, so it cannot ' +
          'serve the web app.\n\n' +
          `Expected it at: ${clientDist}\n\n` +
          'Build the client and redeploy, or set CLIENT_DIST_DIR to the ' +
          'directory your build writes to.\n' +
          'If the frontend is meant to be served by another host (e.g. Vercel), ' +
          'map the custom domain there instead of here.'
      );
  });
}

connectDB().then(async () => {
  // Align every stored role with the current admin rule once per boot, so a
  // grant left over from an earlier rule does not linger as a stale ADMIN. A
  // failure here must not stop the server: requests are also authorised live.
  try {
    await resyncDesignationRoles();
  } catch (err) {
    console.error('[ROLES] startup re-sync failed:', err.message);
  }

  app.listen(config.PORT, () => {
    console.log(
      `[${config.CLUB.name}] Server running on http://localhost:${config.PORT}`
    );
    console.log(`[CORS] Allowed origins: ${config.CLIENT_URLS.join(', ')}`);
    console.log(`[STORAGE] ${config.STORAGE_DIR}`);
    console.log(`[ROLES] ADMIN allowlist: ${config.ADMIN_MEMBER_IDS.join(', ') || '(none)'} + ${config.ADMIN_DESIGNATIONS.join(', ')}`);
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      console.warn(
        '[CRYPTO] FIELD_ENCRYPTION_KEY is not set, so field-level encryption ' +
          'falls back to JWT_SECRET. Set a dedicated, STABLE key before storing ' +
          'member data: changing it later makes encrypted fields (address, email, ' +
          'occupation, education) unreadable.'
      );
    }
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