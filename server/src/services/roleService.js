const config = require('../config/constants');
const User = require('../models/User');

// Top-level ADMIN authority is deliberately narrow and explicit. An account is
// an admin if, and only if:
//   1. its membership ID is listed in ADMIN_MEMBER_IDS (the ALC-001 / ALC-002 /
//      ALC-003 allowlist), or
//   2. it holds a designation in ADMIN_DESIGNATIONS (President / Secretary).
//
// Every other officer — Vice President, Joint Secretary, other Executive
// Committee Members, Treasurer, Librarian — keeps the module access their
// designation grants but is NEVER assigned the ADMIN role or badge. There is no
// other path to ADMIN; the old manual set-role endpoint has been removed.
const ADMIN_MEMBER_IDS = new Set(
  (config.ADMIN_MEMBER_IDS || []).map((s) => String(s).trim().toUpperCase())
);

function staticDesignationGrantsAdmin(designation) {
  return Boolean(designation) && config.ADMIN_DESIGNATIONS.includes(designation);
}

// True when the account's membership ID is on the admin allowlist. Requires an
// APPROVED account: a pending applicant that happens to hold a listed ID (there
// is none today, IDs are minted at approval) is not an admin yet.
function memberIdGrantsAdmin(user) {
  if (!user || user.status !== config.STATUS.APPROVED) return false;
  const id = String(user.membershipId || '').trim().toUpperCase();
  return Boolean(id) && ADMIN_MEMBER_IDS.has(id);
}

// The single source of truth for "does this account hold administrative
// authority". Pure and synchronous, so both the persistence helpers below and
// the route middleware can use it without a query.
function designationGrantsAdmin(user) {
  if (!user || user.status !== config.STATUS.APPROVED) return false;
  return staticDesignationGrantsAdmin(user.designation) || memberIdGrantsAdmin(user);
}

// Mutates `user.role` to match the rule above. Returns true when it changed, so
// the caller knows whether a save is required. Pure (no DB access).
function applyDesignationRole(user) {
  const eligible = designationGrantsAdmin(user);

  if (eligible) {
    if (user.role === config.ROLES.MEMBER) {
      user.role = config.ROLES.ADMIN;
      // 'designation' is the provenance marker for any auto-derived ADMIN
      // (designation- or membership-ID-based). It is what makes the grant
      // revocable: losing the designation/ID demotes the account back to MEMBER.
      user.roleSource = 'designation';
      return true;
    }
    return false;
  }

  // No longer qualifies. Revoke only auto-derived ADMINs; a hand-promoted
  // account (roleSource 'manual') and any SUPER_ADMIN are left alone.
  if (user.role === config.ROLES.ADMIN && user.roleSource === 'designation') {
    user.role = config.ROLES.MEMBER;
    user.roleSource = 'manual';
    return true;
  }
  return false;
}

// Keep a single `user.role` in step with the rule. Persists only on an actual
// transition, so calling this from a read path (getMe / myProfile) does not write
// on every request.
async function syncDesignationRole(user) {
  if (!user) return user;
  if (applyDesignationRole(user)) await user.save();
  return user;
}

// Re-sync every account that could plausibly hold or lose admin authority.
// Called after a designation or membership-ID change, and once at startup, so
// the stored `role` is an exact match for the rule rather than a stale grant.
async function resyncDesignationRoles() {
  const candidates = await User.find({
    $or: [
      { roleSource: 'designation' },
      { designation: { $in: config.EXEC_ACCESS } },
      { membershipId: { $in: config.ADMIN_MEMBER_IDS } },
    ],
  });
  for (const candidate of candidates) {
    if (applyDesignationRole(candidate)) await candidate.save();
  }
}

// The role an account should present, derived purely from the current rule.
// Never steps up SUPER_ADMIN, and reports ADMIN only for a genuine admin, so a
// stale stored role can never put an ADMIN badge on a non-admin.
function effectiveRole(user) {
  if (!user) return config.ROLES.MEMBER;
  if (user.role === config.ROLES.SUPER_ADMIN) return config.ROLES.SUPER_ADMIN;
  return designationGrantsAdmin(user) ? config.ROLES.ADMIN : config.ROLES.MEMBER;
}

module.exports = {
  designationGrantsAdmin,
  staticDesignationGrantsAdmin,
  memberIdGrantsAdmin,
  effectiveRole,
  syncDesignationRole,
  resyncDesignationRoles,
};
