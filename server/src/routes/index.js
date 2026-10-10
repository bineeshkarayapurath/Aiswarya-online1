const express = require('express');
const upload = require('../middleware/upload');
const { galleryUpload } = upload;
const { requireAuth, optionalAuth, requireSuperAdmin, requireMember, requireDesignations, requireOfficerOrAdmin } = require('../middleware/auth');
const { authLimiter, signupLimiter, aiLimiter } = require('../middleware/rateLimit');
const {
  registerRules,
  loginRules,
  setPasswordRules,
  adminLoginRules,
} = require('../middleware/validate');
const auth = require('../controllers/authController');
const bookAssistant = require('../controllers/bookAssistantController');
const admin = require('../controllers/adminController');
const member = require('../controllers/memberController');
const pub = require('../controllers/publicController');
const settings = require('../controllers/settingsController');
const minutes = require('../controllers/minutesController');
const accounts = require('../controllers/accountsController');
const committee = require('../controllers/committeeController');
const gallery = require('../controllers/galleryController');
const catalog = require('../controllers/catalogController');
const assets = require('../controllers/assetController');
const issues = require('../controllers/issueController');
const vouchers = require('../controllers/voucherController');
const cs = require('../controllers/communityServiceController');
const uploadCtrl = require('../controllers/uploadController');
const events = require('../controllers/eventProgramController');
const upcomingEvents = require('../controllers/upcomingEventController');

const config = require('../config/constants');

const EXEC_OFFICERS = [
  'President',
  'Vice President',
  'Secretary',
  'Joint Secretary',
  'Executive Committee Member',
];
const GUILD_LEADS = ['President', 'Secretary'];

const router = express.Router();

// Public
router.get('/public/stats', pub.stats);
router.get('/public/catalog', pub.catalog);
router.get('/public/settings', settings.getSettings);
// Officer signature images — any signed-in member, since they are printed on the
// ID cards members can download. Deliberately separate from /public/settings so
// the signatures are not exposed to anonymous visitors.
router.get('/settings/signatures', requireAuth, settings.getSignatures);
router.get('/public/gallery', gallery.listPublicAlbums);

// Generic image upload (multipart, field "photos"). Public by design so new
// member registration can attach a photo before an account exists. Files are
// stored under server storage/ (served via /uploads/) or relayed to ImgBB when
// IMG_BB_API_KEY is configured — returns permanent public HTTPS URLs.
router.post('/upload', galleryUpload.array('photos', 20), uploadCtrl.uploadPhotos);

// Auth — phone number + bcrypt password. No OTP / SMS delivery anywhere.
// authLimiter counts only failed attempts, so a correct sign-in is never
// throttled while a sweep against set-password's date-of-birth check is.
router.post('/auth/register', signupLimiter, upload.single('photo'), registerRules, auth.register);
router.post('/auth/login', authLimiter, loginRules, auth.login);
// First-login password setup for accounts that predate the password field.
// Only ever sets a FIRST password; it can never overwrite an existing one.
router.post('/auth/set-password', authLimiter, setPasswordRules, auth.setPassword);
router.get('/auth/me', requireAuth, auth.getMe);

// Authority zone — same phone + password credential, gated on the account
// actually holding an authority role (see authController.adminLogin).
router.post('/auth/admin/login', authLimiter, adminLoginRules, auth.adminLogin);

// Admin panel — Approval workflows & committee management (executive roles)
router.post(
  '/admin/requests/:id/approve',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.approveRequest
);
router.post(
  '/admin/requests/:id/reject',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  (req, res, next) => {
    express.json()(req, res, () => next());
  },
  admin.rejectRequest
);
router.put(
  '/admin/requests/:id',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.editRequest
);
router.get(
  '/admin/requests',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.listRequests
);
router.get(
  '/admin/users',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.listAll
);
router.get(
  '/admin/requests/:id',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.getUserById
);
// NOTE: the manual /admin/set-role endpoint has been removed. Top-level ADMIN
// authority is now derived strictly from the membership-ID allowlist and the
// President / Secretary designations (see services/roleService.js); there is no
// longer any API path that can grant ADMIN to an arbitrary account.
router.delete(
  '/admin/users/:id',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.deleteUser
);
router.put(
  '/admin/users/:id',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  admin.updateUser
);
router.post(
  '/admin/dev/clear-members',
  requireAuth,
  requireSuperAdmin,
  admin.clearMembers
);
router.put(
  '/admin/settings',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(GUILD_LEADS),
  settings.updateSettings
);



// Executive Committee (main) — designation management (executive officers)
router.get('/admin/committee/executive', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), admin.listExecutiveCommittee);
router.get('/admin/committee/search', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), admin.searchCommitteeMembers);
router.post('/admin/committee/designation', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), admin.setDesignation);

// Sub-committee management & program registers (executive roles)
router.get('/admin/committee/members', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), admin.listCommitteeMembers);
router.post('/admin/committee/assign', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), admin.assignCommitteeMember);
router.post('/admin/committee/remove', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), admin.removeCommitteeMember);
router.post(
  '/admin/programs',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  upload.uploadManager.fields([
    { name: 'minutesPhoto', maxCount: 1 },
    { name: 'attendanceSheetPhoto', maxCount: 1 },
    { name: 'eventPhotos', maxCount: 8 },
  ]),
  minutes.createProgram
);
router.get(
  '/admin/programs',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  minutes.listPrograms
);
router.get(
  '/admin/programs/:id',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  minutes.getProgram
);
router.post(
  '/admin/programs/:id/approve',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  minutes.approveProgram
);
router.post(
  '/admin/programs/:id/reject',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  (req, res, next) => {
    express.json()(req, res, () => next());
  },
  minutes.rejectProgram
);

// Accounts & Finance (Treasurer) — a Treasurer reaches this module on the
// strength of the designation alone; no top-level ADMIN role required.
router.get('/admin/accounts', requireAuth, requireOfficerOrAdmin(['Treasurer']), accounts.listAccounts);
router.get('/admin/accounts/settings', requireAuth, requireOfficerOrAdmin(['Treasurer']), accounts.getSettings);
router.put('/admin/accounts/settings', requireAuth, requireOfficerOrAdmin(['Treasurer']), accounts.updateSettings);
router.post('/admin/accounts', requireAuth, requireOfficerOrAdmin(['Treasurer']), accounts.createManualEntry);
router.get('/admin/accounts/transfers', requireAuth, requireOfficerOrAdmin(['Treasurer']), accounts.listTransfers);
router.post('/admin/accounts/transfers', requireAuth, requireOfficerOrAdmin(['Treasurer']), accounts.createTransfer);

// Receipts & Vouchers (Treasurer) — auto-syncs with the Accounts ledger.
router.get('/admin/vouchers/members', requireAuth, requireOfficerOrAdmin(['Treasurer']), vouchers.searchMembers);
router.get('/admin/vouchers', requireAuth, requireOfficerOrAdmin(['Treasurer']), vouchers.listVouchers);
router.get('/admin/vouchers/:id', requireAuth, requireOfficerOrAdmin(['Treasurer']), vouchers.getVoucher);
router.post('/admin/vouchers', requireAuth, requireOfficerOrAdmin(['Treasurer']), vouchers.createVoucher);

// Community Service & Relief Fund (executive officers)
router.get('/admin/community-service/members', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.searchMembers);
router.post('/admin/community-service', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), galleryUpload.array('photos', 20), cs.createEvent);
router.get('/admin/community-service', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.listEvents);
router.get('/admin/community-service/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.getEvent);
router.put('/admin/community-service/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.updateEvent);
router.post('/admin/community-service/:id/collections', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.addCollection);
router.delete('/admin/community-service/:id/collections/:collId', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.removeCollection);
router.post('/admin/community-service/:id/expenses', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.addExpense);
router.delete('/admin/community-service/:id/expenses/:expId', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.removeExpense);
router.post('/admin/community-service/:id/photos', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), galleryUpload.array('photos', 20), cs.addPhotos);
router.delete('/admin/community-service/:id/photos/:idx', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), cs.removePhoto);

// Gallery (executive roles)
router.get('/admin/gallery', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), gallery.listAlbums);
router.post(
  '/admin/gallery',
  requireAuth,
  requireOfficerOrAdmin(EXEC_OFFICERS),
  (req, res, next) => {
    // Wrap multer so its errors (file too large, wrong type, too many files)
    // return a clean JSON message instead of Express's HTML error page.
    galleryUpload.array('photos', 20)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Each photo must be under 16 MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'You can upload up to 20 photos per album' });
      }
      return res.status(400).json({ message: err.message || 'Photo upload failed' });
    });
  },
  gallery.createAlbum
);
router.delete('/admin/gallery/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), gallery.deleteAlbum);

// Library books catalog (Librarian)
router.get('/admin/books', requireAuth, requireOfficerOrAdmin(['Librarian']), catalog.listBooks);
router.get('/admin/books/meta', requireAuth, requireOfficerOrAdmin(['Librarian']), catalog.bookMeta);
router.get('/admin/books/available', requireAuth, requireOfficerOrAdmin(['Librarian']), issues.searchBooks);
router.post('/admin/books', requireAuth, requireOfficerOrAdmin(['Librarian']), catalog.createBook);
router.post(
  '/admin/books/bulk',
  requireAuth,
  requireOfficerOrAdmin(['Librarian']),
  upload.spreadsheetUpload.single('file'),
  catalog.bulkUpload
);
router.delete('/admin/books/:id', requireAuth, requireOfficerOrAdmin(['Librarian']), catalog.deleteBook);

// Assets & inventory management (administrative officers)
router.get('/assets', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), assets.list);
router.post('/assets', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), assets.create);
router.put('/assets/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), assets.update);
router.delete('/assets/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), assets.deleteAsset);

// Book Issue & Return Register (Librarian)
router.get('/admin/issues', requireAuth, requireOfficerOrAdmin(['Librarian']), issues.listIssues);
router.get('/admin/issues/stats', requireAuth, requireOfficerOrAdmin(['Librarian']), issues.issueStats);
router.get('/admin/issues/members', requireAuth, requireOfficerOrAdmin(['Librarian']), issues.searchMembers);
router.post('/admin/issues', requireAuth, requireOfficerOrAdmin(['Librarian']), issues.createIssue);
router.post('/admin/issues/:id/return', requireAuth, requireOfficerOrAdmin(['Librarian']), issues.returnBook);

// Events / Program Registrations (dynamic)
const EVENT_MANAGERS = [...EXEC_OFFICERS, 'Librarian'];
// Upcoming Sports & Cultural events — the public "Upcoming Programs" section on
// the home page is driven by the records an officer maintains in the admin
// "Upcoming Events" box (also embedded in /public/catalog; see publicController).
router.get('/public/events', upcomingEvents.list);

router.get('/events', events.listEvents);
router.get('/events/open', requireAuth, requireMember, events.getOpenForUser);
router.get('/events/:id', events.getEvent);
router.post('/events', requireAuth, requireOfficerOrAdmin(EVENT_MANAGERS), events.createEvent);
router.put('/events/:id', requireAuth, requireOfficerOrAdmin(EVENT_MANAGERS), events.updateEvent);
router.put('/events/:id/toggle', requireAuth, requireOfficerOrAdmin(EVENT_MANAGERS), events.toggleRegistration);
router.delete('/events/:id', requireAuth, requireOfficerOrAdmin(EVENT_MANAGERS), events.deleteEvent);

router.get('/event-registrations', requireAuth, requireOfficerOrAdmin(EVENT_MANAGERS), events.listRegistrations);
router.get('/member/event-registrations', requireAuth, requireMember, events.myRegistrations);
router.post('/member/event-registrations', requireAuth, requireMember, events.register);

// Upcoming sports & cultural events management (executive officers). Poster
// images are uploaded first through POST /api/upload, then the returned public
// URL is saved with the event, so this endpoint takes plain JSON.
router.get('/admin/upcoming-events', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), upcomingEvents.list);
router.post('/admin/upcoming-events', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), upcomingEvents.create);
router.put('/admin/upcoming-events/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), upcomingEvents.update);
router.delete('/admin/upcoming-events/:id', requireAuth, requireOfficerOrAdmin(EXEC_OFFICERS), upcomingEvents.remove);

// Member
router.get('/member/profile', requireAuth, requireMember, member.myProfile);
router.get('/member/document/:type', requireAuth, requireMember, member.serveFile);



// AI Book Assistant - approved members only. aiLimiter is a coarse per-IP brake
// on top of the controller's per-member hourly quota, because every question
// costs money at the provider.
router.get('/member/book-assistant', requireAuth, requireMember, bookAssistant.status);
router.post('/member/book-assistant', requireAuth, requireMember, aiLimiter, bookAssistant.ask);
router.get('/vouchers/my-receipts', requireAuth, requireMember, vouchers.myReceipts);
router.get('/member/committee', requireAuth, requireMember, committee.myCommitteeDashboard);
router.get('/member/programs', requireAuth, requireMember, committee.listMyPrograms);
router.post(
  '/member/programs',
  requireAuth,
  requireMember,
  upload.uploadManager.fields([
    { name: 'minutesPhoto', maxCount: 1 },
    { name: 'attendanceSheetPhoto', maxCount: 1 },
    { name: 'eventPhotos', maxCount: 8 },
  ]),
  committee.createMyProgram
);
router.post(
  '/member/programs/:id/resubmit',
  requireAuth,
  requireMember,
  upload.uploadManager.fields([
    { name: 'minutesPhoto', maxCount: 1 },
    { name: 'attendanceSheetPhoto', maxCount: 1 },
    { name: 'eventPhotos', maxCount: 8 },
  ]),
  committee.resubmitProgram
);

module.exports = router;