require('dotenv').config();
const path = require('path');

// Uploads must land in the same place no matter which directory the process was
// started from. Absolute values are honoured as-is; a relative one (the default
// in .env is a bare "storage") is anchored to this package's root, which is the
// server/ directory.
const SERVER_ROOT = path.join(__dirname, '..', '..');

function resolveStorageDir(value) {
  const raw = String(value || '').trim();
  if (!raw) return path.join(SERVER_ROOT, 'storage');
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(SERVER_ROOT, raw);
}

// Comma-separated allowlist of frontend origins (dev + production Vercel).
// These are ALWAYS allowed; CLIENT_URLS/CLIENT_URL on the server (Render) can
// only ADD to the list, never remove the known deployments.
const DEFAULT_CLIENT_URLS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://aiswarya-online1.vercel.app',
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
  // Optional free hosting for uploaded images (ImgBB). When empty, uploads are
  // kept on the server's local storage and served via /uploads/.
  IMG_BB_API_KEY: process.env.IMG_BB_API_KEY || '',
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