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

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== config.ROLES.SUPER_ADMIN) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

function requireMember(req, res, next) {
  if (!req.user || req.user.role !== config.ROLES.MEMBER) {
    return res.status(403).json({ message: 'Members only' });
  }
  next();
}

// Designation-scoped access for authority accounts. Must run AFTER
// requireSuperAdmin. An administrator with no designation (legacy default)
// keeps full access so existing accounts are never locked out.
function requireDesignations(allowed) {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return (req, res, next) => {
    if (!req.user) return res.status(403).json({ message: 'Access denied' });
    if (!req.user.designation) return next();
    if (!roles.includes(req.user.designation)) {
      return res.status(403).json({
        message: `Your designation (${req.user.designation}) does not grant access to this module`,
      });
    }
    next();
  };
}

module.exports = {
  signToken,
  requireAuth,
  requireSuperAdmin,
  requireMember,
  requireDesignations,
};