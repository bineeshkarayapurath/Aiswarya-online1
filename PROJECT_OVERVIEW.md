# Aiswarya Library & Arts & Sports Club — Online Management System

A full-stack membership + club administration platform for **Aiswarya Library & Reading Room Arts & Sports Club, Kuppakolly** (Kerala, India). It manages member applications/approvals, digital ID cards, committees, library catalog, book issues, programs, accounts, receipts/vouchers, community service, gallery, and assets.

## Stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS, Framer Motion, react-router    |
| Backend    | Node.js, Express, Mongoose (MongoDB)                         |
| Auth       | JWT + bcrypt password keyed by phone number                         |
| Hardening  | express-rate-limit on the unauthenticated credential endpoints       |
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
│       ├── lib/             # club meta, permissions, password policy, PDFs, translations
│       └── pages/           # Landing, Register, Member/Authority dashboards, gallery
├── server/                  # Express API
│   ├── src/
│   │   ├── config/db.js     # Mongoose connection
│   │   ├── config/constants.js  # server twin of branding, roles, permissions
│   │   ├── controllers/     # auth, admin, member, accounts, catalog, etc.
│   │   ├── middleware/      # auth, multer uploads
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/index.js  # full API surface
│   │   ├── services/        # role sync, membership IDs, PDF generation, storage utilities
│   │   └── utils/           # storage/publicUrl, imgbb
│   └── server.js            # entry point (express app + static /uploads)
└── scripts/                 # logo / data fix utilities
```

## Key Concepts

- **Membership lifecycle** — `PENDING_APPROVAL → APPROVED / REJECTED`. Applications register
  with photo + personal details and choose a login password, then an executive
  approves and a membership ID (`ALC-001`, …) and PDFs (application + digital ID card) are
  generated automatically.
- **Roles** — `MEMBER`, `ADMIN`, `SUPER_ADMIN`. `ADMIN` gets full dashboard access.
- **Designations** — Executive Committee designations (`President`, `Secretary`, …) gate which
  Authority Dashboard modules an officer can open (see `MODULE_PERMISSIONS`).
- **Sub-committees** — Vanitha Vedi, Bala Vedi, Yuvatha wings with their own rosters.
- **White-labeling** — All branding/feature toggles live in `client/src/config/clubConfig.js` and
  mirror server `config/constants.js` (`CLUB` colors + tagline + qrType).

## Media URL Resolution

Uploaded photos may be stored as absolute CDN URLs (ImgBB) or relative paths
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
| `POST /api/auth/register`              | Membership application (phone + password, + photo) |
| `POST /api/auth/login`              | Member login (phone or membership ID + password; password may be blank for first-time setup) |
| `POST /api/auth/set-password`          | First-login password setup for pre-password accounts |
| `POST /api/auth/admin/login`           | Authority Zone login (officer phone + own password) |
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
  `BCRYPT_SALT_ROUNDS`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `IMG_BB_API_KEY`,
  `MEMBERSHIP_PREFIX`, `SUPER_ADMIN_PHONES`. See `server/.env.example`.
- **client**: `.env` — `VITE_API_BASE_URL` (`/api` in dev, absolute Render URL in production).

### Authentication

There is no OTP, no SMS delivery and no external auth provider. The phone number is the
username; the password is hashed with bcrypt by a `pre('save')` hook on the User model.

- `password` is declared `select: false`, so it is absent from every ordinary query result.
  Only `authController` opts in with `.select('+password')`, and its `publicUser()` helper
  strips the hash before anything is serialised.
- The hash hook fires only when `password` is actually modified, so approving a member or
  changing a designation never re-hashes an existing hash (which would lock them out).
- Policy (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`) is enforced server-side and mirrored
  in `client/src/lib/password.js` so a member is told at the field, not after a round trip.
- Login returns the same `401 Incorrect phone number or password` for an unknown number and a
  wrong password, so the endpoint cannot be used to enumerate members. A correct password on a
  still-pending application returns `403 { pending: true }` — a valid credential never reads as
  a failed one.

**First-login password setup.** Accounts created before this system existed have no password.
`POST /api/auth/login` reports `needsPassword: true` for them, and `POST /api/auth/set-password`
sets their first one. Two properties keep this safe: it only ever sets a *first* password, so it
can never become a password-reset oracle for a live account; and it requires the date of birth
already on record to match. That date of birth is a weak knowledge factor, but with no SMS or
email channel left it is the only thing separating a member from anyone who knows their phone
number. Note that `needsPassword` necessarily reveals that a number *is* registered — accepted
deliberately, since the alternative was locking every existing member out permanently.

Because that member has no password to type, both login forms deliberately allow submitting with
the password field empty, and `login` / `adminLogin` check for a missing password *only after*
establishing that the account has one. A blank password against a real account still returns the
same `401` as a wrong guess. (Requiring a password before the `hasPassword()` check is what made
this flow unreachable in the first place: the form refused to submit, and a member who typed
*anything* to get past it would have created a throwaway password instead.)

The date-of-birth match compares calendar days with one day of slack, so a record written with a
timezone offset (spreadsheet import, Atlas edit) does not lock its owner out permanently. A
record with no date of birth on file is rejected with a message telling the member to contact the
club office, since no date could ever satisfy the check.

**Rate limiting.** `POST /auth/login`, `/auth/admin/login` and `/auth/set-password` share a
per-IP limiter in `src/middleware/rateLimit.js`. It exists mainly because of `set-password`: that
endpoint is guarded only by a date of birth, which is not a secret — it is printed on ID cards and
receipts and shared in club WhatsApp groups — so without a limit, knowing a member's phone number
would be enough to sweep their date of birth and set a password of your choosing.

Only genuine failures count towards the limit (400 and 401). A correct sign-in is never throttled,
however many times the member signs in, and 403 deliberately does not count either, because
`/auth/login` returns 403 for "credentials are valid but the application is still pending" and a
pending member must not be throttled for being pending. 15 failures per 15 minutes, then 429 with
a `Retry-After` header. `server.js` sets `trust proxy` to 1 so the limiter sees the real client IP
rather than the Render proxy's, which would otherwise throttle the whole club at once.

Limiting is per-IP, so members sharing one wifi share a budget. The limit is set high enough that
ordinary typos cannot exhaust it, but a determined attacker from a shared connection is bounded.

**Authority Zone.** Officers sign in with the same phone + password as everyone else; what makes
the session an authority session is the role, not a second secret. `POST /api/auth/admin/login`
requires the number to be in `SUPER_ADMIN_PHONES` **and** the account to hold `ADMIN` /
`SUPER_ADMIN` or an Executive Committee designation. No account is auto-created there — under OTP
that was safe because possession of the handset was proven by SMS, but without it anyone who
learned an officer's number could claim the account by setting its password. An officer with no
account is told to register first.

`server.js` refuses to boot in production if `JWT_SECRET` is missing or left at its default, or if
`SUPER_ADMIN_PHONES` is empty.
