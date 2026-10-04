// Client-side mirror of the server's password policy (config.PASSWORD in
// server/src/config/constants.js, i.e. PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH).
//
// Duplicated on purpose: the server is the authority and re-validates every
// password, but a member should learn their password is too short while they are
// looking at the field, not after a round trip. Both sides read the same numbers
// from the environment, so changing PASSWORD_MIN_LENGTH updates the rule once and
// both halves follow.

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 72;

/**
 * @returns {string|null} An error message, or null when the password is fine.
 */
export function validatePassword(password) {
  const value = String(password || '');
  if (!value) return 'Please choose a password';
  if (value.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (value.length > MAX_LENGTH) return `Password must be at most ${MAX_LENGTH} characters`;
  // Matches the server's single-repeated-character rejection.
  if (/^(.)\1+$/.test(value)) return 'Password is too simple';
  return null;
}

/**
 * Coarse 0-4 strength score for the meter under the field. Advisory only — it is
 * never sent anywhere and the server does not use it.
 */
export function scorePassword(password) {
  const value = String(password || '');
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^\w\s]/.test(value)) score += 1;
  return Math.min(4, score);
}

export const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
export const STRENGTH_TONES = [
  'bg-slate-300',
  'bg-red-500',
  'bg-amber-500',
  'bg-lime-600',
  'bg-emerald-600',
];
