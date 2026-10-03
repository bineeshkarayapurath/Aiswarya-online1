# Aiswarya Library & Arts & Sports Club — Online Management System

A full-stack membership + club administration platform for **Aiswarya Library & Reading Room Arts & Sports Club, Kuppakolly** (Kerala, India). It manages member applications/approvals, digital ID cards, committees, library catalog, book issues, programs, accounts, receipts/vouchers, community service, gallery, and assets.

## Stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS, Framer Motion, react-router    |
| Backend    | Node.js, Express, Mongoose (MongoDB)                         |
| Auth       | JWT + phone OTP (WhatsApp Cloud API), Firebase Phone Auth, master PIN  |
| Documents  | PDFKit (application PDF + digital ID card, officer signatures) |
| Media      | Local `storage/` (served via `/uploads/`) or ImgBB CDN       |
| Images     | QR codes, svg/logo generator scripts                         |
| Deploys    | Vercel (client), Render or similar (server), MongoDB Atlas   |

## Repository Layout

```
├── client/                  # React SPA (Vite)
│   └── src/
│       ├── api/client.js    # axios instance + resolveMedia() URL helper
│       ├── components/      # panels, ID card, PDF preview, navbar, etc.
│       ├── config/clubConfig.js  # MASTER white-label branding + feature toggles
│       ├── context/         # Auth, Locale (EN/ML), Theme
│       ├── lib/             # club meta, permissions, phone auth, PDFs, translations
│       └── pages/           # Landing, Register, Member/Authority dashboards, gallery
├── server/                  # Express API
│   ├── src/
│   │   ├── config/db.js     # Mongoose connection
│   │   ├── config/constants.js  # server twin of branding, roles, permissions
│   │   ├── controllers/     # auth, admin, member, accounts, catalog, etc.
│   │   ├── middleware/      # auth, multer uploads
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/index.js  # full API surface
│   │   ├── services/        # WhatsApp OTP delivery, PDF generation, storage utilities
│   │   └── utils/           # storage/publicUrl, imgbb
│   └── server.js            # entry point (express app + static /uploads)
└── scripts/                 # logo / data fix utilities
```

## Key Concepts

- **Membership lifecycle** — `PENDING_APPROVAL → APPROVED / REJECTED`. Applications register
  with photo + personal details, verify phone via OTP (WhatsApp or Firebase), then an executive
  approves and a membership ID (`AISC-001`, …) and PDFs (application + digital ID card) are
  generated automatically.
- **Roles** — `MEMBER`, `ADMIN`, `SUPER_ADMIN`. `ADMIN` gets full dashboard access.
- **Designations** — Executive Committee designations (`President`, `Secretary`, …) gate which
  Authority Dashboard modules an officer can open (see `MODULE_PERMISSIONS`).
- **Sub-committees** — Vanitha Vedi, Bala Vedi, Yuvatha wings with their own rosters.
- **White-labeling** — All branding/feature toggles live in `client/src/config/clubConfig.js` and
  mirror server `config/constants.js` (`CLUB` colors + tagline + qrType).

## Media URL Resolution

Uploaded photos may be stored as absolute CDN URLs (ImgBB / Firebase) or relative paths
(`photos/abc.jpg`, `/uploads/photos/abc.jpg`). Two helpers keep every `<img>` working:

- **Server** `publicUrl()` (`server/src/utils/storage.js`) — prefixes `/uploads/` paths with
  `PUBLIC_API_URL` so documents/PDFs load from the backend's own domain.
- **Client** `resolveMedia()` (`client/src/api/client.js`) — prefixes relative paths with the
  backend origin for dev proxy or cross-domain (Vercel → Render) deployments; passes absolute
  URLs through untouched.

## API Surface (highlighted routes)

| Route                                  | Purpose                                 |
|----------------------------------------|-----------------------------------------|
| `POST /api/upload`                     | Generic image upload (local / ImgBB)    |
| `POST /api/auth/register`              | Membership application (+ photo)        |
| `POST /api/auth/send-otp` / `verify-otp`| Phone OTP send/verify                  |
| `POST /api/auth/member-login`          | Member login (phone or membership ID)   |
| `POST /api/auth/admin/send-otp` / `verify` | Authority login (phone + master PIN) |
| `GET /api/auth/me`                     | Current authenticated user              |
| `GET /api/member/profile`              | Member's own profile                    |
| `GET /api/member/document/:type`       | Download application / ID-card PDF      |
| `GET  /api/admin/requests`          | Applications by status (pending/approved/rejected) |
| `POST /api/admin/requests/:id/approve` | Approve + auto-assign membership ID + PDFs |
| `POST /api/admin/requests/:id/reject`  | Reject with reason                       |
| `GET  /api/admin/users`             | Approved members list (role management)  |
| `POST /api/admin/set-role`             | Toggle MEMBER / ADMIN                   |
| `GET  /api/admin/committee/executive`  | Executive committee roster + photos     |
| `GET  /api/admin/committee/search`     | ID/name/phone autocomplete              |
| `GET  /api/public/stats` / `settings`  | Landing stats + footer/social contact   |
| `GET  /api/settings/signatures`         | Officer signature URLs (any member)     |

Admin-only modules (each additionally gated by designation): programs & minutes, accounts &
transfers, receipts & vouchers, community service & relief fund, gallery, book catalog (bulk
XLSX), book issues, assets, sub-committee management, and system settings.

### Officer signatures

System Settings uploads a signature image for the President and the Secretary (same
`POST /api/upload` endpoint as member photos — local storage, or ImgBB when `IMG_BB_API_KEY`
is set). Once saved they are applied automatically, with no per-document step:

- **ID cards** — the Secretary's signature is printed on the back of every digital ID card
  (both the on-screen card and the downloadable PDF), resting on the "Authorised Signature" rule.
- **PDFs / letterheads** — both configured signatures are appended as signatory blocks at the
  foot of the application/letterhead PDF, captioned with the current officer's name.

`server/src/services/signatureService.js` resolves a stored signature to something PDFKit can
embed: local storage paths directly, remote (ImgBB) URLs downloaded once and cached under
`storage/signatures/`. A document is never given a blank line where a signature is expected —
if nothing is configured the block is simply omitted.

## Development

Frontend dev server proxies `/api` → backend via `vite.config.js`.

```bash
# Server
cd server
npm install
npm run dev            # http://localhost:5000

# Client
cd client
npm install
npm run dev            # http://localhost:5173
```

### Environment

- **server**: `.env` — `MONGO_URI`, `JWT_SECRET`, `PUBLIC_API_URL`, `CLIENT_URLS`,
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`,
  `IMG_BB_API_KEY`, `MASTER_PIN`, `SUPER_ADMIN_PHONES`, and optionally
  `DEV_ECHO_OTP`. See `server/.env.example`.
- **client**: `.env` — `VITE_API_BASE_URL` (`/api` in dev, absolute Render URL in production).

### Authentication

There are no hardcoded test credentials, fixed OTPs, or backdoor accounts. Every code is
generated per request by `generateOtp()` (`server/src/utils/otp.js`), stored as a bcrypt hash
in the `Otp` collection, and verified against that record — so no fixed value can be typed in
to bypass it. Authority
login is authorised solely by `SUPER_ADMIN_PHONES` plus `MASTER_PIN`, both required from the
environment; `server.js` refuses to boot in production if `JWT_SECRET`, `MASTER_PIN`,
`SUPER_ADMIN_PHONES`, `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` are missing or
left at their defaults.

Codes are delivered over Meta's WhatsApp Cloud API
(`server/src/services/whatsappService.js`) using an approved AUTHENTICATION template —
WhatsApp is an OTT service, so no TRAI DLT header is involved; the template is approved by
Meta instead, which also means its wording is fixed by Meta rather than chosen per message.

In local development the WhatsApp API is skipped and the real generated code is written to the
server console (`[WHATSAPP-DEV] OTP for <phone>: <code>`) — read it from there, or set
`DEV_ECHO_OTP=true` to have it returned in the API response so the UI can show it. That
flag is ignored in production.
