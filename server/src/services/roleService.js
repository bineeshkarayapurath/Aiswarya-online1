const config = require('../config/constants');
const User = require('../models/User');

// Designations that carry top-level ADMIN authority on their own. Only these,
// plus the single authorized Executive Committee Member, ever receive ADMIN.
const STATIC_ADMIN = config.ADMIN_DESIGNATIONS;
const EXEC_MEMBER = config.EXEC_ADMIN_DESIGNATION;

// Kept for callers that only need the static half of the rule.
function staticDesignationGrantsAdmin(designation) {
  return Boolean(designation) && STATIC_ADMIN.includes(designation);
}

// The authorized Executive Committee Member: the FIRST approved member holding
// the "Executive Committee Member" designation (earliest appointment, then
// earliest account). Exactly one executive carries admin authority; every other
// executive keeps their module access without the top-level ADMIN role.
async function authorizedExecId() {
  const exec = await User.findOne({
    status: config.STATUS.APPROVED,
    designation: EXEC_MEMBER,
  })
    .sort({ designationUpdatedAt: 1, _id: 1 })
    .select('_id');
  return exec ? String(exec._id) : null;
}

function isAuthorizedExecutive(user, authExecId) {
  if (!user || !authExecId) return false;
  const id = String(user._id || user.id || '');
  return (
    Boolean(id) &&
    id === String(authExecId) &&
    user.status === config.STATUS.APPROVED &&
    user.designation === EXEC_MEMBER
  );
}

// Does this account hold top-level administrative authority? `authExecId` is the
// value returned by authorizedExecId(); pass it when checking many users at once
// to avoid re-querying per user.
function designationGrantsAdmin(user, authExecId) {
  if (!user || user.status !== config.STATUS.APPROVED) return false;
  return (
    staticDesignationGrantsAdmin(user.designation) ||
    isAuthorizedExecutive(user, authExecId)
  );
}

// Mutates `user.role` to match its designation. Returns true when it changed, so
// the caller knows whether a save is required. Kept pure (no DB access) so it can
// be applied to a batch with a single authorizedExecId() lookup.
function applyDesignationRole(user, authExecId) {
  const eligible = designationGrantsAdmin(user, authExecId);

  if (eligible) {
    if (user.role === config.ROLES.MEMBER) {
      user.role = config.ROLES.ADMIN;
      user.roleSource = 'designation';
      return true;
    }
    return false;
  }

  // No longer qualifies. Revoke only designation-derived ADMINs; manually
  // promoted accounts and SUPER_ADMINs are left alone.
  if (user.role === config.ROLES.ADMIN && user.roleSource === 'designation') {
    user.role = config.ROLES.MEMBER;
    user.roleSource = 'manual';
    return true;
  }
  return false;
}

// Keep a single `user.role` in step with `user.designation`. Persists only on an
// actual transition, so calling this from a read path (getMe / myProfile) does
// not write on every request.
async function syncDesignationRole(user, authExecId) {
  if (!user) return user;
  const execId = authExecId === undefined ? await authorizedExecId() : authExecId;
  if (applyDesignationRole(user, execId)) await user.save();
  return user;
}

// Re-sync every officer at once. Required when a designation changes because the
// authorized Executive Committee Member is positional: appointing or removing one
// executive can promote or demote another account, and only a full pass keeps the
// ADMIN role an exact match for the rule.
async function resyncDesignationRoles() {
  const execId = await authorizedExecId();
  const candidates = await User.find({
    $or: [
      { roleSource: 'designation' },
      { designation: { $in: config.EXEC_ACCESS } },
    ],
  });
  for (const candidate of candidates) {
    if (applyDesignationRole(candidate, execId)) await candidate.save();
  }
}

// The role an account should present, derived from its designation. Pure —
// performs no database write — so read endpoints can report authorised officers
// as ADMIN without persisting on every list request.
//
// Never steps up SUPER_ADMIN, and never rewrites a role an admin set by hand.
function effectiveRole(user, authExecId) {
  if (!user) return config.ROLES.MEMBER;
  if (user.role !== config.ROLES.MEMBER) return user.role;
  if (designationGrantsAdmin(user, authExecId)) {
    return config.ROLES.ADMIN;
  }
  return user.role;
}

module.exports = {
  designationGrantsAdmin,
  effectiveRole,
  syncDesignationRole,
  resyncDesignationRoles,
  authorizedExecId,
};
