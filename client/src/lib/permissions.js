// Mirrors the module-access mapping enforced server-side (server constants
// MODULE_PERMISSIONS) so the Authority Dashboard can hide tiles the logged-in
// administrator's designation cannot open.
export const DESIGNATIONS = {
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  SECRETARY: 'Secretary',
  JOINT_SECRETARY: 'Joint Secretary',
  TREASURER: 'Treasurer',
  LIBRARIAN: 'Librarian',
  EXECUTIVE_MEMBER: 'Executive Committee Member',
};

export const DESIGNATION_ROLES = Object.values(DESIGNATIONS);

// Executive officers granted administrative capacity: overview, approval
// workflows and sub-committee / program management.
const EXEC_GROUP = [
  DESIGNATIONS.PRESIDENT,
  DESIGNATIONS.VICE_PRESIDENT,
  DESIGNATIONS.SECRETARY,
  DESIGNATIONS.JOINT_SECRETARY,
  DESIGNATIONS.EXECUTIVE_MEMBER,
];

export const MODULE_PERMISSIONS = {
  approvals: EXEC_GROUP,
  members: EXEC_GROUP,
  committee: ['President', 'Secretary'],
  catalog: ['Librarian'],
  issues: ['Librarian'],
  programs: EXEC_GROUP,
  accounts: ['Treasurer'],
  vouchers: ['Treasurer'],
  communityService: EXEC_GROUP,
  gallery: EXEC_GROUP,
  vanitha: EXEC_GROUP,
  bala: EXEC_GROUP,
  yuvatha: EXEC_GROUP,
  assets: EXEC_GROUP,
  settings: ['President', 'Secretary'],
};

// An authority account without a designation keeps full access (legacy
// default) so existing administrators are never locked out.
export function canAccessModule(key, designation) {
  if (!designation) return true;
  const allowed = MODULE_PERMISSIONS[key];
  return Array.isArray(allowed) && allowed.includes(designation);
}

export function canManageModule(key, designation) {
  return canAccessModule(key, designation);
}