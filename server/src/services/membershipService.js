const config = require('../config/constants');
const User = require('../models/User');

// "Who counts as a club member" used to be re-derived independently in the stats
// endpoint, the member pickers and the executive roster, and the definitions
// drifted apart. It lives here so there is exactly one answer.
//
// The distinction that matters is NOT the role and NOT the membership ID: it is
// whether the account belongs to an actual person. authController's authority
// login auto-provisions a placeholder for each officer phone number, and because
// that flow has no personal details it stores the phone number as the full name
// and "Club Office" as the address. Those accounts exist only to let an officer
// sign in; they are not members and must never be counted.
//
// Officers and office-bearers ARE members and ARE counted — they are real people
// who registered and were approved, they merely also hold a designation.

// True for the placeholder accounts created by the authority-login flow. New ones
// carry an explicit flag; the name/address signature additionally catches
// placeholders created before that flag existed.
function isAuthorityLogin(user) {
  if (!user) return false;
  if (user.authorityLogin === true) return true;
  return user.fullName === user.phoneNumber && user.address === 'Club Office';
}

// Matches every approved account that belongs to a real person.
//
// Deliberately does NOT require a membershipId. That requirement was the reason
// approved members went missing from the count: a membership ID is allocated at
// approval, but an account can reach APPROVED through other routes too, so
// gating the count on it silently under-reported real members.
//
// $expr is required because MongoDB cannot compare two fields in a normal
// matcher. It cannot use an index, but it is applied only to the APPROVED subset
// of a members table, which is orders of magnitude smaller than the catalog.
const APPROVED_MEMBER_FILTER = {
  status: config.STATUS.APPROVED,
  authorityLogin: { $ne: true },
  $expr: { $ne: ['$fullName', '$phoneNumber'] },
};

async function countApprovedMembers() {
  return User.countDocuments(APPROVED_MEMBER_FILTER);
}

// Compute the next membership ID (AISC-001, AISC-002, ...) from the number of
// approved members so the sequence always continues from the last assigned ID.
// A uniqueness check bumps past any gap left by removed members.
async function nextMembershipId() {
  const count = await countApprovedMembers();
  let seq = count + 1;
  let id = `${config.MEMBERSHIP_PREFIX}-${String(seq).padStart(3, '0')}`;
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({ membershipId: id })) {
    seq += 1;
    id = `${config.MEMBERSHIP_PREFIX}-${String(seq).padStart(3, '0')}`;
  }
  return id;
}

// Guarantee an approved member carries a sequential, strictly-unique membership
// ID (e.g. AISC-001, AISC-002). Approved records that were created before ID
// assignment (legacy / direct ADMIN accounts) are backfilled on read instead of
// ever surfacing a blank placeholder or a raw MongoDB ObjectId.
//
// Authority-login placeholders are skipped: minting a real membership ID for one
// would make it indistinguishable from a member and quietly change every member
// count the moment an officer opened the members list.
async function ensureMembershipId(user) {
  if (!user) return '';
  if (user.membershipId) return user.membershipId;
  if (user.status !== config.STATUS.APPROVED) return '';
  if (isAuthorityLogin(user)) return '';
  user.membershipId = await nextMembershipId();
  await user.save();
  return user.membershipId;
}

module.exports = {
  APPROVED_MEMBER_FILTER,
  countApprovedMembers,
  ensureMembershipId,
  isAuthorityLogin,
  nextMembershipId,
};