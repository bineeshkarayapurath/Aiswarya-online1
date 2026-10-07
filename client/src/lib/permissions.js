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
  // New Year 2027 program registration: executive officers plus the Librarian
  // designated on the Executive Committee list.
  programRegistration: [...EXEC_GROUP, 'Librarian'],
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
// default) so existing administrators are never locked out. ADMIN-role
// accounts (Executive Committee admins) always have full module access.
export function canAccessModule(key, designation, role) {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
  if (!designation) return true;
  const allowed = MODULE_PERMISSIONS[key];
  return Array.isArray(allowed) && allowed.includes(designation);
}

export function canManageModule(key, designation, role) {
  return canAccessModule(key, designation, role);
}

// Does this designation carry top-level admin access on its own?
// Mirrors the server's EXEC_ACCESS / designationGrantsAdmin().
export function isDesignationAdmin(designation) {
  return Boolean(designation) && EXEC_GROUP.includes(designation);
}



// The role a member effectively presents. A President / Secretary / Executive
// Committee Member is ADMIN by virtue of the designation, exactly like the
// server's effectiveRole(). Keeps the members table honest even if it is
// rendered from a payload that predates the auto-grant.
export function effectiveRole(member) {
  if (!member) return 'MEMBER';
  if (member.role && member.role !== 'MEMBER') return member.role;
  if (member.status === 'APPROVED' && isDesignationAdmin(member.designation)) return 'ADMIN';
  return 'MEMBER';
}

// The label to print wherever the UI would otherwise show a flat "MEMBER":
// the member's exact office when they hold one, otherwise the access role, and
// only "Member" for a member with neither. Presentation only — it never grants
// or hides access, which stays with effectiveRole() / canAccessModule().
export function roleLabel(member) {
  const designation = String(member?.designation || '').trim();
  if (designation) return designation;
  const role = member?.role;
  if (role && role !== 'MEMBER') return role;
  return 'Member';
}

// True when the member's ADMIN comes from the designation rather than an
// explicit set-role. Their admin access cannot be revoked by the role dropdown
// — only by changing the designation — so the control is shown as fixed.
export function roleIsDesignationDerived(member) {
  return (
    member?.role === 'MEMBER' &&
    member?.status === 'APPROVED' &&
    isDesignationAdmin(member.designation)
  );
}