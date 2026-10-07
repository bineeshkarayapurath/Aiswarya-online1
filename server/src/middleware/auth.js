const jwt = require('jsonwebtoken');
const config = require('../config/constants');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { id: user._id, phone: user.phoneNumber, role: user.role },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const payload = jwt.verify(header.split(' ')[1], config.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Best-effort authentication for endpoints reachable by the public as well as
// by a signed-in member (the program registration form). A valid token attaches
// req.user; a missing or invalid one simply continues anonymously instead of
// returning 401.
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const payload = jwt.verify(header.split(' ')[1], config.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (user) req.user = user;
    }
  } catch (err) {
    // Ignore — the request proceeds as a public one.
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || (req.user.role !== config.ROLES.SUPER_ADMIN && req.user.role !== config.ROLES.ADMIN)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

// Member-zone access. Any APPROVED account is a club member (MEMBER role, or
// an ADMIN / SUPER_ADMIN authority account that was promoted from a member
// record), so the member profile / documents remain reachable for all of them.
function requireMember(req, res, next) {
  if (!req.user || req.user.status !== config.STATUS.APPROVED) {
    return res.status(403).json({ message: 'Members only' });
  }
  next();
}

// Designation-scoped access for authority accounts. Must run AFTER
// requireSuperAdmin. An administrator with no designation (legacy default)
// keeps full access so existing accounts are never locked out. ADMIN and
// SUPER_ADMIN roles are never scoped by designation — they hold full module
// access (System Settings, Approvals, etc.) regardless of their committee
// title, mirroring the frontend canAccessModule() override.
const ADMIN_ROLES = [config.ROLES.ADMIN, config.ROLES.SUPER_ADMIN];
function requireDesignations(allowed) {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return (req, res, next) => {
    if (!req.user) return res.status(403).json({ message: 'Access denied' });
    if (ADMIN_ROLES.includes(req.user.role)) return next();
    if (!req.user.designation) return next();
    if (!roles.includes(req.user.designation)) {
      return res.status(403).json({
        message: `Your designation (${req.user.designation}) does not grant access to this module`,
      });
    }
    next();
  };
}

// Module access for a single specialist officer. Replaces the
// requireSuperAdmin + requireDesignations pair on routes owned by one
// designation (a Treasurer owns Accounts/Vouchers, a Librarian owns
// Catalog/Issues), which previously demanded a top-level ADMIN role and made the
// designation list unreachable: an ADMIN short-circuits requireDesignations, and
// a plain MEMBER was stopped by requireSuperAdmin first.
//
// Grants access when either:
//   - the account is ADMIN / SUPER_ADMIN (full access, as before), or
//   - it is an APPROVED member whose designation is in `allowed`.
// Nothing else reaches the controller, so a Treasurer still cannot open
// approvals, settings, gallery or the committee.
function requireOfficerOrAdmin(allowed) {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return (req, res, next) => {
    const u = req.user;
    if (!u) return res.status(403).json({ message: 'Access denied' });
    if (ADMIN_ROLES.includes(u.role)) return next();
    if (u.status === config.STATUS.APPROVED && u.designation && roles.includes(u.designation)) {
      return next();
    }
    return res.status(403).json({
      message: u.designation
        ? `Your designation (${u.designation}) does not grant access to this module`
        : 'Access denied',
    });
  };
}

module.exports = {
  signToken,
  requireAuth,
  optionalAuth,
  requireSuperAdmin,
  requireMember,
  requireDesignations,
  requireOfficerOrAdmin,
};