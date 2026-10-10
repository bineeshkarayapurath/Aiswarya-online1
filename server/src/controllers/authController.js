const config = require('../config/constants');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { syncDesignationRole } = require('../services/roleService');

// Normalise a phone number so "9999999999", "919999999999", "+91 99999 99999"
// all match the same value (Indian mobile = 10 digits). The phone number is the
// username, so this is what every login-path lookup is keyed by.
function canonicalPhone(v) {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

const SUPER_ADMIN_PHONES = config.SUPER_ADMIN_PHONES.map(canonicalPhone);

// Look the account up by whatever the member typed, WITH the password hash
// attached. The hash is select:false on the schema, so a credential check has to
// opt in — doing it inside this one helper means no caller can forget, and none
// of them has to run a second query to get it.
function findByIdentifier(identifier) {
  const input = String(identifier || '').trim();
  const query = /^[A-Za-z0-9]+-\d+(-\d+)?$/.test(input)
    ? { membershipId: input.toUpperCase() }
    : { phoneNumber: canonicalPhone(input) };
  return User.findOne(query).select('+password');
}

// Every auth response goes through here. `password` is select:false so a plain
// find() cannot return it, but a document that was just loaded with
// .select('+password') — or assigned a plaintext password moments before
// save() hashed it — still carries the value in memory. Stripping it centrally
// is what makes "never leak the hash" a property of the module rather than
// something each endpoint has to remember.
function publicUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.lowerPhone;
  return obj;
}

// Enforce the configured password policy. Returns an error message, or null when
// the password is acceptable. Shared by registration and the first-login
// set-password flow so both apply exactly the same rules.
function validatePassword(password) {
  const value = String(password == null ? '' : password);
  if (!value) return 'Password is required';
  if (value.length < config.PASSWORD.minLength) {
    return `Password must be at least ${config.PASSWORD.minLength} characters`;
  }
  if (value.length > config.PASSWORD.maxLength) {
    return `Password must be at most ${config.PASSWORD.maxLength} characters`;
  }
  // A single repeated character ("aaaaaaaa") satisfies every naive length rule
  // while being the first thing any offline cracking run tries.
  if (/^(.)\1+$/.test(value)) return 'Password is too simple';
  return null;
}

// Registration: the member picks their phone number and password up front, and
// the pair becomes their credential for life. confirmPassword is compared here as
// well as in the form, so a client that skips the check cannot set a password the
// member did not intend to confirm.
exports.register = async (req, res) => {
  try {
    const {
      identifier,
      password,
      confirmPassword,
      fullName,
      dob,
      address,
      occupation,
      education,
      recommenderName,
      recommenderMemberId,
      email,
    } = req.body;

    if (!identifier || !fullName || !dob || !address) {
      return res
        .status(400)
        .json({ message: 'identifier, fullName, dob, and address are required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'password is required' });
    }
    if (confirmPassword != null && String(confirmPassword) !== String(password)) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    const passwordProblem = validatePassword(password);
    if (passwordProblem) return res.status(400).json({ message: passwordProblem });

    const phone = canonicalPhone(identifier);
    if (phone.length !== 10) {
      return res
        .status(400)
        .json({ message: 'A valid 10-digit phone number is required' });
    }

    const existing = await User.findOne({ phoneNumber: phone });
    if (existing && existing.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ message: 'This phone number is already registered' });
    }

    const dobDate = new Date(dob);
    const age = Math.floor(
      (Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Member photo: a public HTTPS URL from POST /api/upload (local storage or
    // ImgBB) wins when present; otherwise fall back to the locally stored file.
    const externalPhotoUrl = String(req.body.photoUrl || '').trim();
    const photoUrl = externalPhotoUrl
      ? externalPhotoUrl
      : req.file
        ? `photos/${req.file.filename}`
        : undefined;

    // A rejected member re-applying reuses the same record but gets a fresh
    // password, so the credentials they are submitting are the live ones.
    const user =
      existing && existing.status === 'PENDING_APPROVAL'
        ? existing
        : new User({ phoneNumber: phone });

    user.fullName = fullName;
    user.dob = dobDate;
    user.age = age;
    user.address = address;
    user.occupation = occupation || '';
    user.education = education || '';
    user.email = email || '';
    user.recommender = {
      name: recommenderName || '',
      memberId: recommenderMemberId || '',
    };
    user.registrationNo = config.CLUB.regNo;
    user.status = config.STATUS.PENDING;
    // Assigned raw here; the pre-save hook is what turns it into a bcrypt hash.
    // Nothing between this line and user.save() may read it back.
    user.password = String(password);

    if (photoUrl) user.photoUrl = photoUrl;

    await user.save();

    return res.status(201).json({
      message: 'Registration successful',
      user: publicUser(user),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Registration failed' });
  }
};

// Member login: phone number (or membership ID) + password.
//
// Every failure returns the same 401 with the same message. Distinguishing
// "no such account" from "wrong password" would let anyone enumerate which phone
// numbers are registered with the club.
function invalidCredentials(res) {
  return res.status(401).json({ message: 'Incorrect phone number or password' });
}

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: 'identifier is required' });
    }

    const user = await findByIdentifier(identifier);
    if (!user) return invalidCredentials(res);
    if (!user.hasPassword()) {
      // A passwordless record cannot be logged into yet. Saying so is what lets
      // the UI offer the first-login set-password step. Note this necessarily
      // reveals that the number IS registered — accepted deliberately, because
      // the alternative was locking every pre-existing member out of their own
      // account with no way back.
      //
      // This check must come BEFORE any password requirement. A first-time member
      // has no password to type, so demanding one here made the set-password step
      // unreachable: the UI would refuse to submit, and a member who typed anything
      // to get past it would create a throwaway password instead.
      return res.json({
        needsPassword: true,
        identifier: user.phoneNumber,
      });
    }

    // Past this point the account really does have a password, so a blank one is
    // just a failed login. Answer 401, not 400, so an empty field is
    // indistinguishable from a wrong guess and leaks nothing extra.
    if (!password) return invalidCredentials(res);

    const ok = await user.verifyPassword(password);
    if (!ok) return invalidCredentials(res);

    // Tell the member their application is still pending rather than pretending
    // the credentials are wrong — a correct password must never read as a
    // failure, or they will keep retyping it.
    if (user.status !== config.STATUS.APPROVED) {
      return res.status(403).json({
        message:
          user.status === config.STATUS.PENDING
            ? 'Your membership application is still pending approval.'
            : 'Your membership application was not approved. Please contact the club office.',
        pending: user.status === config.STATUS.PENDING,
      });
    }

    // Admin access is derived automatically from the membership ID allowlist or
    // a President / Secretary designation, so the session carries the right role
    // without anyone having to run set-role by hand.
    await syncDesignationRole(user);

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Login failed' });
  }
};

// First-login password setup for records that predate the phone/password system.
//
// Without a second channel there is nothing to prove ownership of a passwordless
// account except what the member already told us at registration, so the date of
// birth is required and must match. That is a deliberate trade: it is a weak
// knowledge factor, but it is far better than letting anyone who knows a member's
// phone number claim their account by setting a password.
//
// This route only ever SETS a first password. It cannot change an existing one,
// so it can never be used to take over a live account.
exports.setPassword = async (req, res) => {
  try {
    const { identifier, password, confirmPassword, dob } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'identifier and password are required' });
    }
    if (confirmPassword != null && String(confirmPassword) !== String(password)) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    const passwordProblem = validatePassword(password);
    if (passwordProblem) return res.status(400).json({ message: passwordProblem });

    const existing = await findByIdentifier(identifier);
    if (!existing) return invalidCredentials(res);

    // Refuse when a password is already set. Without this, this endpoint would be
    // a password-reset oracle for every account in the club.
    if (existing.hasPassword()) {
      return res
        .status(400)
        .json({ message: 'A password is already set for this account' });
    }

    // Ownership check. Compare calendar days only, so a timezone difference
    // between the member's browser and the server cannot reject a correct date.
    if (!dob) {
      return res.status(400).json({ message: 'Date of birth is required' });
    }
    const claimed = new Date(dob);
    if (Number.isNaN(claimed.getTime())) {
      return res.status(400).json({ message: 'Date of birth is invalid' });
    }
    // A record with no date of birth on file can never satisfy this check, so
    // say who has to fix it instead of leaving the member guessing.
    if (!existing.dob || Number.isNaN(new Date(existing.dob).getTime())) {
      return res.status(400).json({
        message:
          'Our records have no date of birth for this number. Please contact the club office to have it corrected.',
      });
    }

    // Allow one day of slack. Dates written with a timezone offset (as a
    // spreadsheet import or an Atlas edit can) land on the previous UTC day, which
    // would otherwise lock the member out of their own account permanently.
    // One day is negligible next to the strength of this factor.
    const dayIndex = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const daysApart =
      Math.abs(dayIndex(claimed) - dayIndex(new Date(existing.dob))) / 86400000;
    if (daysApart > 1) {
      return res.status(401).json({
        message: 'Date of birth does not match our records',
      });
    }

    existing.password = String(password);
    await existing.save();

    return res.json({
      message: 'Password set. Please sign in.',
      identifier: existing.phoneNumber,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Could not set password' });
  }
};

// Authority Zone login.
//
// Officers authenticate with the same phone + password credential as everyone
// else; what makes the session an authority session is the role, not a second
// secret. Access is therefore granted on either of two independent grounds:
//
//   1. the number is listed in SUPER_ADMIN_PHONES, or
//   2. the account already holds ADMIN / SUPER_ADMIN (directly, or through an
//      Executive Committee designation).
//
// No account is auto-created here. The previous flow minted a throwaway record
// for any officer number on first login, which was safe only because possession of
// the handset was proven by an SMS OTP. With OTP gone, that would mean anyone who
// learned an officer's number could claim the account and set its password — so
// an officer without an account is told to register instead.
exports.adminLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'phone is required' });
    }

    const canonical = canonicalPhone(phone);
    if (!canonical) return invalidCredentials(res);

    // Reject unknown numbers before touching the database so the endpoint does
    // not become a membership oracle.
    if (!SUPER_ADMIN_PHONES.includes(canonical)) {
      return res
        .status(403)
        .json({ message: 'Unauthorised phone number for the Authority Zone' });
    }

    const found = await User.findOne({ phoneNumber: canonical });
    const user = found ? await User.findById(found._id).select('+password') : null;
    if (!user) {
      return res.status(403).json({
        message:
          'No authority account exists for this number. Please register as a member first, then ask the club secretary to assign your Executive Committee designation.',
      });
    }
    if (!user.hasPassword()) {
      // As in member login: reach this branch without a password, because a
      // designated officer who predates the password system has none to type.
      return res.json({ needsPassword: true, identifier: user.phoneNumber });
    }

    if (!password) return invalidCredentials(res);

    const ok = await user.verifyPassword(password);
    if (!ok) return invalidCredentials(res);

    if (user.status !== config.STATUS.APPROVED) {
      return res
        .status(403)
        .json({ message: 'This account is pending approval and cannot access the Authority Zone' });
    }

    // An officer who registered through the public form and is on the admin
    // allowlist (or was assigned President / Secretary) gets the matching role
    // here, so the session is authorised without anyone running set-role.
    await syncDesignationRole(user);

    const isAuthority =
      user.role === config.ROLES.ADMIN ||
      user.role === config.ROLES.SUPER_ADMIN ||
      config.EXEC_ACCESS.includes(user.designation);
    if (!isAuthority) {
      return res.status(403).json({
        message:
          'This account does not hold an Executive Committee designation. Please contact the club secretary.',
      });
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Login failed' });
  }
};

exports.getMe = async (req, res) => {
  // A designation change made by another officer takes effect on the next
  // profile fetch, so a promoted/deposed member never keeps a stale role.
  await syncDesignationRole(req.user);
  return res.json({ user: publicUser(req.user) });
};
