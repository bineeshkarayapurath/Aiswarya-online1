// ============================================================================
//  MASTER WHITE-LABEL CONFIGURATION — the single source of truth for this
//  tenant's branding, organization details, theme and feature toggles.
//
//  To rebrand this SaaS template for another library / club / association,
//  edit ONLY this file. It feeds:
//    - Tailwind (tailwind.config.js imports themeColors) for the whole UI
//    - CSS custom properties (src/lib/theme.js) for runtime-styled surfaces
//    - <title>, meta description and favicon at boot (src/lib/theme.js)
//    - every component that imports CLUB from src/lib/club (re-exported here)
//
//  The server twin of the brand values lives in
//  server/src/config/constants.js -> CLUB (colors mirror themeColors.{primary,
//  accent, pdf}; tagline mirrors branding.tagline; qrType mirrors
//  organization.qrType) so server-generated PDFs / ID cards stay in sync.
//
//  NOTE: Tailwind compiles utility classes at build time, so after changing
//  themeColors be sure to rebuild the client (`npm run build` in client/).
//  Runtime CSS variables still update instantly for var() consumers.
// ============================================================================

export const clubConfig = {
  // ------------------------------------------------------------------------
  //  Organization — printed on headers, footers, PDFs, receipts, ID cards.
  // ------------------------------------------------------------------------
  organization: {
    name: 'Aiswarya Library & Arts & Sports Club', // short display name
    fullName:
      'Aiswarya Library & Reading Room Arts & Sports Club, Kuppakolly', // official / long name
    longName: 'Aiswarya Library & Reading Room Arts & Sports Club', // long name without place (ID cards)
    shortName: 'Aiswarya Library', // mobile-nav compact brand
    nameMalayalam: 'ഐശ്വര്യ ലൈബ്രറി ആൻഡ് റീഡിങ് റൂം ആർട്സ് ആൻഡ് സ്പോർട്സ് ക്ലബ്ബ്, കുപ്പക്കൊല്ലി',
    place: 'Kuppakolly',
    placeMalayalam: 'കുപ്പക്കൊല്ലി',
    regNo: '12 BTY 6652',
    establishedYear: 1985, // used in taglines ("since 1985")
    qrType: 'AISWARYA_MEMBER', // membership QR payload marker (verification scans)
    address: 'Kuppakolly P.O., 670 301, Kannur District, Kerala',
    phone: '+91 94466 00000',
    email: 'aiswaryalibrarykuppakolly@gmail.com',
    // Fallback contact/social links — the live values are fetched from the
    // server's ClubSettings (GET /api/public/settings) and override these.
    social: {
      mapsUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      whatsappUrl: '',
      youtubeUrl: '',
    },
  },

  // ------------------------------------------------------------------------
  //  Branding assets + session boilerplate.
  // ------------------------------------------------------------------------
  branding: {
    logo: '/assets/club-logo.png', // primary logo (nav, footer, PDF letterhead)
    favicon: '/assets/club-logo.png', // browser tab icon
    heroBannerLight: '/assets/club-banner-light.png', // landing banner (light theme)
    heroBannerDark: '/assets/club-banner-dark.png', // landing banner (dark theme)
    tagline: 'Library • Arts • Sports', // used under letterhead titles / PDFs
  },

  // ------------------------------------------------------------------------
  //  Theme colors — used verbatim by Tailwind (emerald + gold utilities) and
  //  mapped to CSS variables at runtime for raw-hex surfaces.
  // ------------------------------------------------------------------------
  themeColors: {
    // Primary brand color family (Tailwind `emerald-*` classes).
    primary: {
      950: '#022c22',
      900: '#0f3d2e',
      800: '#134e38',
      700: '#166644',
      600: '#1a7a50',
      500: '#1f9460',
      400: '#34d399',
      300: '#6ee7b7',
      200: '#a7f3d0',
      100: '#d1fae5',
      50: '#ecfdf5',
    },
    // Accent color family (Tailwind `gold-*` classes + gradients).
    accent: {
      DEFAULT: '#b8860b',
      700: '#8b6508',
      500: '#b8860b',
      300: '#e5c64a',
      100: '#f8f0d1',
      50: '#fdfbf3',
    },
    // Dark-mode surfaces (used by index.css overrides).
    dark: {
      bg: '#022c22', // page background
      surface: '#0a382c', // cards / panels
      surfaceAlt: '#0d4033', // secondary surfaces
      border: 'rgba(52, 211, 153, 0.2)',
      borderSoft: 'rgba(52, 211, 153, 0.15)',
      textBright: '#f0fdf4',
      text: '#d1fae5',
      textDim: '#a7f3d0',
    },
    // Server-generated PDF / ID-card inks (mirrors server constants).
    pdf: {
      ink: '#0f172a',
      grey: '#475569',
      cream: '#fdf6e6',
      cardCream1: '#fdf9ee',
      cardCream2: '#f3ead3',
      label: '#8a7a3c',
      accentLight: '#c9971c',
    },
    qr: '#0f3d2e', // QR foreground color
  },

  // ------------------------------------------------------------------------
  //  Feature toggles — hides / shows entire modules across the app
  //  (landing sections, nav links, admin + member dashboards).
  //
  //  Sub-committee visibility is gated by enableSubcommittees (master switch)
  //  AND the individual wing flag.
  // ------------------------------------------------------------------------
  features: {
    enableApprovals: true, // Approval Control Panel (member applications)
    enableMembers: true, // Approved Members List
    enableCommittee: true, // Executive Committee management
    enableCatalog: true, // Library Books Catalog
    enableIssues: true, // Book Issue & Return Register
    enablePrograms: true, // Program & Minutes Register
    enableAccounts: true, // Accounts & Finance
    enableVouchers: true, // Receipts & Vouchers (auto-syncs with Accounts)
    enableCommunityService: true, // Community Support / relief fund & aid
    enableGallery: true, // Photo Gallery
    enableAssets: true, // Assets & Inventory
    enableSettings: true, // System Settings

    // Sub-committee wings
    enableSubcommittees: true, // master switch for all wings
    enableVanitha: true, // Vanitha Vedi (women's wing)
    enableBala: true, // Bala Vedi (children's wing)
    enableYuvatha: true, // Yuvatha (youth forum)
    enableSportsSubcommittee: true, // sports / youth wing (maps to Yuvatha)
  },
};

// Convenience accessor so components read gated flags without long chains.
export function featureEnabled(key) {
  return clubConfig.features[key] !== false; // absent flag = enabled
}

export function subcommitteeEnabled(wing) {
  if (!clubConfig.features.enableSubcommittees) return false;
  return clubConfig.features[wing] !== false;
}

// Map a dashboard module key to its feature toggle.
export function moduleEnabled(moduleKey) {
  const map = {
    approvals: 'enableApprovals',
    members: 'enableMembers',
    committee: 'enableCommittee',
    catalog: 'enableCatalog',
    issues: 'enableIssues',
    programs: 'enablePrograms',
    accounts: 'enableAccounts',
    vouchers: 'enableVouchers',
    communityService: 'enableCommunityService',
    gallery: 'enableGallery',
    assets: 'enableAssets',
    settings: 'enableSettings',
    vanitha: 'enableVanitha',
    bala: 'enableBala',
    yuvatha: 'enableYuvatha',
  };
  if (!map[moduleKey]) return true; // unknown modules default to enabled
  if (['vanitha', 'bala', 'yuvatha'].includes(moduleKey) && !clubConfig.features.enableSubcommittees) {
    return false;
  }
  return clubConfig.features[map[moduleKey]] !== false;
}

// Backward-compatible CLUB object (components import { CLUB } from lib/club).
export const CLUB = {
  name: clubConfig.organization.name,
  fullName: clubConfig.organization.fullName,
  longName: clubConfig.organization.longName,
  fullNameMalayalam: clubConfig.organization.nameMalayalam,
  place: clubConfig.organization.place,
  fullName_short: `${clubConfig.organization.name}, ${clubConfig.organization.place}`,
  regNo: clubConfig.organization.regNo,
  logo: clubConfig.branding.logo,
  establishedYear: clubConfig.organization.establishedYear,
  tagline: clubConfig.branding.tagline,
};

export default clubConfig;