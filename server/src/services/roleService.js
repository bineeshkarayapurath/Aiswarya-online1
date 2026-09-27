const config = require('../config/constants');

// Roles that an Executive Committee designation can auto-grant. Reuses
// config.EXEC_ACCESS — the same audited list that gates the approval,
// member, program and sub-committee modules — so a designation can never
// hand out more access than the dashboard already shows it.
//
// Treasurer and Librarian are deliberately absent: they reach Accounts /
// Vouchers and Catalog / Issues through MODULE_PERMISSIONS without needing a
// top-level admin role.
const AUTO_GRANT = config.EXEC_ACCESS;

// Does this designation carry administrative authority on its own?
function designationGrantsAdmin(designation) {
  return Boolean(designation) && AUTO_GRANT.includes(designation);
}

// Keep `user.role` in step with `user.designation`.
//
// Promotes a qualifying officer to ADMIN, and demotes an account back to MEMBER
// once the designation no longer qualifies — but ONLY when the role was
// itself designation-derived. Roles an admin set by hand (roleSource 'manual')
// and SUPER_ADMIN accounts are never touched, so this can revoke exactly the
// access it granted and nothing more.
//
// Persists only on an actual transition, so calling this from a read path
// (getMe / myProfile) does not write on every request.
async function syncDesignationRole(user) {
  if (!user) return user;

  // Only an APPROVED member can hold office, so a pending/rejected applicant
  // never gets an admin role from a designation.
  const eligible = user.status === config.STATUS.APPROVED && designationGrantsAdmin(user.designation);

  if (eligible) {
    if (user.role === config.ROLES.MEMBER) {
      user.role = config.ROLES.ADMIN;
      user.roleSource = 'designation';
      await user.save();
    }
    return user;
  }

  // Designation no longer qualifies. Revoke only designation-derived ADMINs;
  // manually promoted accounts and SUPER_ADMINs are left alone.
  if (user.role === config.ROLES.ADMIN && user.roleSource === 'designation') {
    user.role = config.ROLES.MEMBER;
    user.roleSource = 'manual';
    await user.save();
  }
  return user;
}

// The role an account should present, derived from its designation. Pure —
// performs no database write — so read endpoints can report President and
// Secretary officers as ADMIN without persisting on every list request.
// syncDesignationRole() is what actually commits the change; this keeps the
// displayed value correct in the meantime (e.g. legacy records written before
// the auto-grant existed, or a designation set outside setDesignation).
//
// Never steps up SUPER_ADMIN, and never rewrites a role an admin set by hand.
function effectiveRole(user) {
  if (!user) return config.ROLES.MEMBER;
  if (user.role !== config.ROLES.MEMBER) return user.role;
  if (user.status === config.STATUS.APPROVED && designationGrantsAdmin(user.designation)) {
    return config.ROLES.ADMIN;
  }
  return user.role;
}

module.exports = {
  AUTO_GRANT,
  designationGrantsAdmin,
  effectiveRole,
  syncDesignationRole,
};
