require('dotenv').config();
const path = require('path');

// Uploads must land in the same place no matter which directory the process was
// started from. Absolute values are honoured as-is; a relative one (the default
// in .env is a bare "storage") is anchored to this package's root, which is the
// server/ directory.
const SERVER_ROOT = path.join(__dirname, '..', '..');

// The repo root, one level above server/. Client paths resolve against this
// rather than the process cwd, for the same reason STORAGE_DIR does.
const REPO_ROOT = path.join(SERVER_ROOT, '..');

function resolveAgainst(base, value) {
  const raw = String(value || '').trim();
  if (!raw) return base;
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(base, raw);
}

function resolveStorageDir(value) {
  const raw = String(value || '').trim();
  if (!raw) return path.join(SERVER_ROOT, 'storage');
  return resolveAgainst(SERVER_ROOT, raw);
}

// Comma-separated allowlist of frontend origins (dev + production Vercel).
// These are ALWAYS allowed; CLIENT_URLS/CLIENT_URL on the server (Render) can
// only ADD to the list, never remove the known deployments.
//
// The club's custom domain belongs here. The frontend is deployed on Vercel but
// reached in production through https://www.aiswaryakuppakolly.online, and that
// is the origin the browser sends to the API on Render - the Vercel *.vercel.app
// host was never part of those requests. Leaving the custom domain out meant
// every login came back with no Access-Control-Allow-Origin header and the
// browser discarded it, which reported as "the whole site is broken" rather than
// as the CORS miss it was. The apex (non-www) is listed too because a visitor
// who omits the www lands on the other host and the allowlist is an exact
// scheme+host+port match, not a wildcard.
const DEFAULT_CLIENT_URLS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://aiswarya-online1.vercel.app',
  'https://www.aiswaryakuppakolly.online',
  'https://aiswaryakuppakolly.online',
];

const envOrigins = [process.env.CLIENT_URLS, process.env.CLIENT_URL]
  .filter(Boolean)
  .join(',')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CLIENT_URLS: Array.from(new Set([...DEFAULT_CLIENT_URLS, ...envOrigins])),
  // Public base URL of this API (e.g. https://your-api.onrender.com). When set,
  // stored /uploads/... paths are returned to the client as fully-qualified URLs
  // so photos and PDFs load from the backend's separate production domain.
  PUBLIC_API_URL: process.env.PUBLIC_API_URL || '',
  // Accounts are keyed by phone number and protected by a bcrypt-hashed
  // password. There is no OTP / SMS delivery of any kind.
  MONGO_URI:
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aiswarya_library',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  SUPER_ADMIN_PHONES: (process.env.SUPER_ADMIN_PHONES || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  // Password policy, enforced server-side in authController and mirrored by the
  // registration form so a member is never told about it only after submitting.
  PASSWORD: {
    // bcrypt work factor. 12 is the current sane default: ~250 ms per hash on
    // commodity hardware, which is slow enough to make offline cracking
    // expensive while staying fast enough for an interactive login. Raise it
    // freely — the cost is only paid at registration and login.
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    // Caps how long a submitted password can be. bcrypt silently truncates
    // beyond 72 BYTES, so two passwords sharing a 72-byte prefix would
    // otherwise be interchangeable. Refusing the oversized input is clearer
    // than pretending to hash it.
    maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH || '72', 10),
  },
  // Library lending rules
  LOAN_DAYS: parseInt(process.env.LOAN_DAYS || '14', 10),
  FINE_PER_DAY: Number(process.env.FINE_PER_DAY || 5),
  // Where uploaded photos, member photos, PDFs and QR codes live.
  //
  // A relative STORAGE_DIR (e.g. "storage" in .env) used to be handed to
  // path.join untouched, so every consumer resolved it against process.cwd().
  // The write side (multer) and the read side (express.static) then pointed at
  // different directories whenever the server was started from a different
  // folder — running it from the repo root versus from server/ produced two
  // separate storage/ trees, and photos written by one were 404s from the other.
  // Resolving against the server package root instead makes the location
  // independent of where the process happens to be launched from.
  STORAGE_DIR: resolveStorageDir(process.env.STORAGE_DIR),
  // Where the built client bundle lives, i.e. the directory containing the
  // index.html that express.static serves and the SPA fallback falls back to.
  //
  // Defaults to <repo>/client/dist, which is what `npm run build` inside
  // client/ produces, and is anchored to the repo root so it does not depend on
  // the directory the process was started from (or on Render's Root Directory
  // setting being server/ rather than the repo root).
  //
  // Override with CLIENT_DIST_DIR when a host's build step writes the bundle
  // somewhere else - a CI job that publishes dist/ next to server/, or an
  // artifact directory. The 404-everything symptom of a wrong path here is
  // indistinguishable from "the custom domain is not mapped", so it is worth
  // being able to correct from the dashboard instead of a redeploy of new code.
  CLIENT_DIST_DIR: resolveAgainst(REPO_ROOT, process.env.CLIENT_DIST_DIR || 'client/dist'),

  // Optional free hosting for uploaded images (ImgBB). When empty, uploads are
  // kept on the server's local storage and served via /uploads/.
  IMG_BB_API_KEY: process.env.IMG_BB_API_KEY || '',

  // AI Book Assistant.
  //
  // Deliberately provider-agnostic: anything exposing an OpenAI-compatible
  // POST {base}/chat/completions works, so the club is not tied to one vendor.
  //   OpenAI      AI_BASE_URL=https://api.openai.com/v1
  //   OpenRouter  AI_BASE_URL=https://openrouter.ai/api/v1
  //   Groq        AI_BASE_URL=https://api.groq.com/openai/v1
  //   Gemini      AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
  //   Ollama      AI_BASE_URL=http://127.0.0.1:11434/v1  (AI_API_KEY can be "ollama")
  // With no key the feature reports itself as unconfigured rather than failing
  // with a confusing upstream error.
  AI: {
    // .trim() handles a stray newline from copy-paste. Surrounding quotes are
    // stripped too: a dashboard or shell that stores AI_API_KEY="AIza..." sends
    // those quote characters to the provider verbatim, which comes back as a
    // baffling 401 "API key not valid" rather than an obvious config error.
    apiKey: (process.env.AI_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1'),
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '25000', 10),
    // Each question costs money, so a signed-in member is capped per hour.
    maxPerHour: parseInt(process.env.AI_MAX_PER_HOUR || '20', 10),
  },
  COMMITTEES: {
    VANITHA: 'Vanitha Vedi',
    BALA: 'Bala Vedi',
    YUVATHA: 'Yuvatha',
  },
  COMMITTEE_ROLES: [
    'General Member',
    'President',
    'Secretary',
    'Treasurer',
    'Executive Member',
  ],
  EXECUTIVE_ROLES: ['President', 'Secretary', 'Treasurer', 'Executive Member'],
  OFFICER_ROLES: ['President', 'Secretary'],
  // Main Executive Committee designations ("users.designation").
  DESIGNATION_ROLES: [
    'President',
    'Vice President',
    'Secretary',
    'Joint Secretary',
    'Treasurer',
    'Librarian',
    'Executive Committee Member',
  ],
  EXECUTIVE_COMMITTEE: 'Executive Committee',
  // Executive officers granted the administrative capacity: overview, approval
  // workflows and sub-committee / program management.
  // Doubles as the set of designations that auto-grant the ADMIN role (see
  // services/roleService.js), so an officer can never hold a top-level admin
  // role for a module the designation would not already open.
  EXEC_ACCESS: [
    'President',
    'Vice President',
    'Secretary',
    'Joint Secretary',
    'Executive Committee Member',
  ],
  // Which Authority Dashboard modules each designation may open. An authority
  // account with NO designation keeps full access (legacy default), so the
  // frontend treats it as "all modules" and the API gate as wide open.
  MODULE_PERMISSIONS: {
    approvals: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    members: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    committee: ['President', 'Secretary'],
    catalog: ['Librarian'],
    issues: ['Librarian'],
    programs: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    // New Year 2027 program registration. The Librarian is granted oversight
    // alongside the executive officers (view / verify / manage the lists).
    programRegistration: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member', 'Librarian'],
    accounts: ['Treasurer'],
    vouchers: ['Treasurer'],
    communityService: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    gallery: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    vanitha: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    bala: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    yuvatha: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    assets: ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Executive Committee Member'],
    settings: ['President', 'Secretary'],
  },
  SECTIONS: ['Main', 'Vanitha Vedi', 'Bala Vedi', 'Yuvatha'],
  OFFICIABLE_SECTIONS: ['Vanitha Vedi', 'Bala Vedi', 'Yuvatha'],


  // Prefix for generated membership IDs (e.g. ALC-001). Read by
  // services/membershipService.nextMembershipId(); it was previously read from
  // here while never being defined here, so every newly minted ID came out as
  // the string "undefined-001".
  MEMBERSHIP_PREFIX: process.env.MEMBERSHIP_PREFIX || 'ALC',
  CLUB: {
    name: 'Aiswarya Library & Arts & Sports Club',
    fullName: 'Aiswarya Library & Reading Room Arts & Sports Club, Kuppakolly',
    longName: 'Aiswarya Library & Reading Room Arts & Sports Club',
    place: 'Kuppakolly',
    regNo: '12 BTY 6652',
    establishedYear: 1985,
    tagline: 'Library • Arts • Sports',
    qrType: 'AISWARYA_MEMBER',
    // Canonical official contact. ClubSettings overrides these at runtime (see
    // services/clubContactService.js, the single resolver used by the website,
    // the PDFs and the ID cards); these are the fallback that keeps printing the
    // right details when the settings row has not been filled in yet.
    // client/src/config/clubConfig.js organization.{address,phone,email} is the
    // client twin — change both.
    address:
      'Aiswarya Library and Reading Room, Arts and Sports Club, Kuppakkolly, Ambalavayal P.O., Wayanad, PIN: 673593',
    // Intentionally blank. The club asked for the old "+91 94466 00000" placeholder
    // to be removed rather than published, so there is no fallback number here: the
    // footer, the letterhead and the ID cards print the phone only when
    // ClubSettings.phoneNumber has one. Every consumer already filters an empty
    // value, so nothing renders a blank line — publish a number in Admin ->
    // System Settings and it appears on all of those surfaces at once.
    phone: '',
    email: '12bty6652@gmail.com',
    // Mirrors client themeColors (white-label twin). Change the client config
    // and keep these in sync for server-generated PDFs / ID cards.
    colors: {
      ink: '#0f172a',
      grey: '#475569',
      primary900: '#0f3d2e',
      primary600: '#1a7a50',
      gold: '#b8860b',
      accentLight: '#c9971c',
      label: '#8a7a3c',
      cream: '#fdf6e6',
    },
  },
  ROLES: {
    MEMBER: 'MEMBER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
  },
  STATUS: {
    PENDING: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
  ISSUE_STATUS: {
    ISSUED: 'ISSUED',
    RETURNED: 'RETURNED',
    OVERDUE: 'OVERDUE',
  },
};