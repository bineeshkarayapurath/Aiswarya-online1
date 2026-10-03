require('dotenv').config();
const path = require('path');

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
  // No test phone / test OTP exists. Every code is generated per request by
  // otp.generateOtp(), stored as a bcrypt hash, and verified against the
  // database — there is no fixed value that can be typed in to bypass that.
  MONGO_URI:
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aiswarya_library',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  // Authority Zone master PIN. Intentionally has NO default: an unset value
  // fails every comparison, so a misconfigured deployment is locked out rather
  // than open. server.js refuses to boot in production without it.
  MASTER_PIN: process.env.MASTER_PIN || '',
  SUPER_ADMIN_PHONES: (process.env.SUPER_ADMIN_PHONES || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  // Opt-in echo of the real, freshly generated OTP back to the caller so local
  // dev can show it in the UI. Off unless explicitly enabled, and always
  // ignored in production. Reading the code from the server console needs no
  // flag at all.
  DEV_ECHO_OTP:
    process.env.NODE_ENV !== 'production' &&
    String(process.env.DEV_ECHO_OTP || '').toLowerCase() === 'true',
  MEMBERSHIP_PREFIX: process.env.MEMBERSHIP_PREFIX || 'AISC',
  MEMBERSHIP_YEAR: process.env.MEMBERSHIP_YEAR || new Date().getFullYear(),
  // Library lending rules
  LOAN_DAYS: parseInt(process.env.LOAN_DAYS || '14', 10),
  FINE_PER_DAY: Number(process.env.FINE_PER_DAY || 5),
  STORAGE_DIR: process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage'),
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
  OTP_DIGITS: parseInt(process.env.OTP_DIGITS || '6', 10),
  // OTP delivery over Meta's WhatsApp Cloud API. Unlike SMS, WhatsApp messages
  // are billed per conversation and are NOT routed through a TRAI DLT header —
  // the template is approved by Meta instead, under category AUTHENTICATION.
  WHATSAPP: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'login_otp_template',
    // Must match the language the template was approved in, or Meta returns
    // 132001. en_US is the default for templates created in the dashboard.
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
    // Templates with the one-tap autofill / "copy code" button need the OTP
    // repeated as a button parameter. Set false for templates without it —
    // sending a button parameter for a button-less template is rejected.
    templateHasOtpButton:
      String(process.env.WHATSAPP_TEMPLATE_HAS_OTP_BUTTON || 'true').toLowerCase() === 'true',
    // Graph pins a version's behaviour for ~2 years, so this is worth bumping
    // deliberately rather than riding v17.0 forever.
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v17.0',
    timeoutMs: parseInt(process.env.WHATSAPP_TIMEOUT_MS || '10000', 10),
  },
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