const express = require('express');
const upload = require('../middleware/upload');
const { galleryUpload } = upload;
const { requireAuth, requireSuperAdmin, requireMember, requireDesignations } = require('../middleware/auth');
const auth = require('../controllers/authController');
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
router.get('/public/gallery', gallery.listPublicAlbums);

// Generic image upload (multipart, field "photos"). Public by design so new
// member registration can attach a photo before an account exists. Files are
// stored under server storage/ (served via /uploads/) or relayed to ImgBB when
// IMG_BB_API_KEY is configured — returns permanent public HTTPS URLs.
router.post('/upload', galleryUpload.array('photos', 20), uploadCtrl.uploadPhotos);

// Auth
router.post('/auth/send-otp', auth.sendOtp);
router.post('/auth/verify-otp', auth.verifyOtp);
router.post('/auth/register', upload.single('photo'), auth.register);
router.post('/auth/member-login', auth.memberLogin);
router.get('/auth/me', requireAuth, auth.getMe);

// Authority zone
router.post('/auth/admin/send-otp', auth.adminLoginSendOtp);
router.post('/auth/admin/verify', auth.adminLoginVerify);

// Admin panel — Approval workflows & committee management (executive roles)
router.post(
  '/admin/requests/:id/approve',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.approveRequest
);
router.post(
  '/admin/requests/:id/reject',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  (req, res, next) => {
    express.json()(req, res, () => next());
  },
  admin.rejectRequest
);
router.put(
  '/admin/requests/:id',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.editRequest
);
router.get(
  '/admin/requests',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.listRequests
);
router.get(
  '/admin/users',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.listAll
);
router.get(
  '/admin/requests/:id',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.getUserById
);
router.post(
  '/admin/set-role',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.setRole
);
router.delete(
  '/admin/users/:id',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.deleteUser
);
router.put(
  '/admin/users/:id',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  admin.updateUser
);
router.post(
  '/admin/dev/clear-members',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
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
router.get('/admin/committee/executive', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), admin.listExecutiveCommittee);
router.get('/admin/committee/search', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), admin.searchCommitteeMembers);
router.post('/admin/committee/designation', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), admin.setDesignation);

// Sub-committee management & program registers (executive roles)
router.get('/admin/committee/members', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), admin.listCommitteeMembers);
router.post('/admin/committee/assign', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), admin.assignCommitteeMember);
router.post('/admin/committee/remove', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), admin.removeCommitteeMember);
router.post(
  '/admin/programs',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
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
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  minutes.listPrograms
);
router.get(
  '/admin/programs/:id',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  minutes.getProgram
);
router.post(
  '/admin/programs/:id/approve',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  minutes.approveProgram
);
router.post(
  '/admin/programs/:id/reject',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
  (req, res, next) => {
    express.json()(req, res, () => next());
  },
  minutes.rejectProgram
);

// Accounts & Finance (Treasurer)
router.get('/admin/accounts', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), accounts.listAccounts);
router.get('/admin/accounts/settings', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), accounts.getSettings);
router.put('/admin/accounts/settings', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), accounts.updateSettings);
router.post('/admin/accounts', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), accounts.createManualEntry);
router.get('/admin/accounts/transfers', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), accounts.listTransfers);
router.post('/admin/accounts/transfers', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), accounts.createTransfer);

// Receipts & Vouchers (Treasurer) — auto-syncs with the Accounts ledger.
router.get('/admin/vouchers/members', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), vouchers.searchMembers);
router.get('/admin/vouchers', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), vouchers.listVouchers);
router.get('/admin/vouchers/:id', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), vouchers.getVoucher);
router.post('/admin/vouchers', requireAuth, requireSuperAdmin, requireDesignations(['Treasurer']), vouchers.createVoucher);

// Community Service & Relief Fund (executive officers)
router.get('/admin/community-service/members', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.searchMembers);
router.post('/admin/community-service', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), galleryUpload.array('photos', 20), cs.createEvent);
router.get('/admin/community-service', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.listEvents);
router.get('/admin/community-service/:id', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.getEvent);
router.put('/admin/community-service/:id', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.updateEvent);
router.post('/admin/community-service/:id/collections', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.addCollection);
router.delete('/admin/community-service/:id/collections/:collId', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.removeCollection);
router.post('/admin/community-service/:id/expenses', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.addExpense);
router.delete('/admin/community-service/:id/expenses/:expId', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.removeExpense);
router.post('/admin/community-service/:id/photos', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), galleryUpload.array('photos', 20), cs.addPhotos);
router.delete('/admin/community-service/:id/photos/:idx', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), cs.removePhoto);

// Gallery (executive roles)
router.get('/admin/gallery', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), gallery.listAlbums);
router.post(
  '/admin/gallery',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(EXEC_OFFICERS),
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
router.delete('/admin/gallery/:id', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), gallery.deleteAlbum);

// Library books catalog (Librarian)
router.get('/admin/books', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), catalog.listBooks);
router.get('/admin/books/meta', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), catalog.bookMeta);
router.get('/admin/books/available', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), issues.searchBooks);
router.post('/admin/books', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), catalog.createBook);
router.post(
  '/admin/books/bulk',
  requireAuth,
  requireSuperAdmin,
  requireDesignations(['Librarian']),
  upload.spreadsheetUpload.single('file'),
  catalog.bulkUpload
);
router.delete('/admin/books/:id', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), catalog.deleteBook);

// Assets & inventory management (administrative officers)
router.get('/assets', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), assets.list);
router.post('/assets', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), assets.create);
router.put('/assets/:id', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), assets.update);
router.delete('/assets/:id', requireAuth, requireSuperAdmin, requireDesignations(EXEC_OFFICERS), assets.deleteAsset);

// Book Issue & Return Register (Librarian)
router.get('/admin/issues', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), issues.listIssues);
router.get('/admin/issues/stats', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), issues.issueStats);
router.get('/admin/issues/members', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), issues.searchMembers);
router.post('/admin/issues', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), issues.createIssue);
router.post('/admin/issues/:id/return', requireAuth, requireSuperAdmin, requireDesignations(['Librarian']), issues.returnBook);

// Member
router.get('/member/profile', requireAuth, requireMember, member.myProfile);
router.get('/member/document/:type', requireAuth, requireMember, member.serveFile);
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