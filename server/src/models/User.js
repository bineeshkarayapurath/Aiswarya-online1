const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/constants');
const { encryptField, decryptField } = require('../utils/fieldCrypto');

// A String field stored AES-256-CBC encrypted at rest and decrypted on read.
// The set/get pair is what keeps controllers untouched: assigning a plaintext
// value encrypts it on the way to MongoDB, and reading the property (or a
// toObject()/toJSON() with getters enabled, set on the schema below) returns
// plaintext again. See utils/fieldCrypto.js for the format and why re-saving is
// safe (the setter no-ops on an already-encrypted value).
function encryptedString(options = {}) {
  return {
    ...options,
    type: String,
    set: encryptField,
    get: decryptField,
  };
}

const UserSchema = new mongoose.Schema(
  {
  fullName: { type: String, required: true },
  // The phone number IS the username: it is what a member types on the login
  // screen and what /auth/login and /auth/set-password look the account up by.
  // Stored exactly as registration supplied it (the client normalises to the
  // bare 10-digit national number before it is sent) and mirrored into
  // `lowerPhone` for digit-insensitive lookups.
  phoneNumber: { type: String, required: true, unique: true },
  lowerPhone: { type: String, unique: true, sparse: true },

  // bcrypt hash of the member's password — never the plaintext, never selected
  // by a normal query.
  //
  // `select: false` is the important half: it keeps the hash out of every
  // find()/findOne() result, so a controller that spreads `user.toObject()` into
  // an API response cannot leak it by accident. The only code that needs the
  // hash must ask for it explicitly with .select('+password'), which the login
  // and set-password paths in authController do.
  //
  // Optional, not required: accounts that predate the phone/password system have
  // no password yet and set one on their next login (see authController.setPassword).
  password: { type: String, default: undefined, select: false },
  // When the current password was set. Distinguishes "never had a password"
  // from "has one" without exposing the hash, and gives a hook for future
  // password-age / forced-rotation rules.
  passwordUpdatedAt: { type: Date, default: null },

  // Encrypted at rest (field-level AES-256-CBC).
  email: encryptedString({ default: '' }),
  membershipId: { type: String, index: { unique: true, sparse: true } },
  registrationNo: { type: String, default: '12 BTY 6652' },
  dob: { type: Date, required: true },
  age: { type: Number },
  // Encrypted at rest. Required on the raw (ciphertext) value, which is always
  // non-empty once the setter has run, so validation is unaffected.
  address: encryptedString({ required: true }),
  occupation: encryptedString(),
  education: encryptedString(),
  photoUrl: { type: String },

  recommender: {
    name: { type: String, default: '' },
    memberId: { type: String, default: '' },
  },

  subCommittees: [
    {
      committeeName: { type: String, default: '' },
      role: { type: String, default: 'General Member' },
      isExecutive: { type: Boolean, default: false },
    },
  ],

  role: {
    type: String,
    enum: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    default: 'MEMBER',
  },

  // Provenance of `role`. 'manual' = a role set directly (never auto-revoked).
  // 'designation' = auto-derived from the admin rule (an allowlisted membership
  // ID or a President / Secretary designation), so losing that qualification
  // demotes the account back to MEMBER. Defaults to 'manual' so pre-existing
  // accounts keep their role until the next re-sync.
  roleSource: {
    type: String,
    enum: ['manual', 'designation'],
    default: 'manual',
  },

  // Main Executive Committee designation. Powers role-based dashboard access
  // for authority accounts ('' = general member / legacy full access).
  designation: {
    type: String,
    enum: [
      '',
      'President',
      'Vice President',
      'Secretary',
      'Joint Secretary',
      'Treasurer',
      'Librarian',
      'Executive Committee Member',
    ],
    default: '',
  },
  designationUpdatedAt: { type: Date },

  status: {
    type: String,
    enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
    default: 'PENDING_APPROVAL',
    // Not indexed on its own: the compound { status, membershipId } index at
    // the bottom of this file serves status-only queries too, so a second index
    // here would just add write cost. See the home page stats note there.
  },

  // Marks the throwaway account that used to be auto-created when an officer's
  // phone number hit the Authority Zone login. That flow is gone (the Authority
  // Zone now authenticates like any other account, with a password), so no new
  // records carry this flag; it is retained so the member-count filters keep
  // excluding placeholders created before the move. See isAuthorityLogin in
  // services/membershipService.
  authorityLogin: { type: Boolean, default: false },

  applicationPdfUrl: { type: String },
  idCardPdfUrl: { type: String },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectionReason: { type: String },

  createdAt: { type: Date, default: Date.now },
  },
  {
    // Apply field getters (decryption) whenever a document is serialised, so
    // toObject()/JSON responses always carry plaintext. Reading a property
    // directly (doc.address) applies getters regardless; this covers the object
    // and JSON forms that controllers spread into responses.
    toObject: { getters: true },
    toJSON: { getters: true },
  }
);

// Hash the password on the way in. Runs only when `password` was actually
// modified, so re-saving a user (an approval, a designation change) never
// re-hashes an existing hash — which would silently lock the member out, since
// bcrypt.compare against a doubly-hashed value always fails.
UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  // An empty value means "leave it unset", not "set the password to the empty
  // string". Guarding here is what lets a controller clear an optional field
  // without the schema turning it into a valid (and unusable) credential.
  if (typeof this.password === 'string' && this.password.length) {
    this.password = await bcrypt.hash(this.password, config.PASSWORD.saltRounds);
    this.passwordUpdatedAt = new Date();
  }
  return next();
});

// Mirrors the phone number for digit-insensitive lookups. Kept in its own hook
// so it cannot be skipped by an early return in the hash hook above.
UserSchema.pre('save', function normalisePhone(next) {
  this.lowerPhone = (this.phoneNumber || '').replace(/\D/g, '');
  next();
});

// Compare a candidate password against the stored hash. Always answers false for
// an account that has no password yet, so a passwordless record can never be
// "matched" by sending an empty string.
UserSchema.methods.verifyPassword = function verifyPassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(String(candidate == null ? '' : candidate), this.password);
};

// True when this account has yet to choose a password (records that predate the
// phone/password system, and the first-login flow the UI offers them).
UserSchema.methods.hasPassword = function hasPassword() {
  return typeof this.password === 'string' && this.password.length > 0;
};

// The home page stats strip counts APPROVED members and PENDING applications
// on every load, and status was unindexed — both countDocuments calls scanned
// the whole member roll. Leading with `status` serves the PENDING count on its
// own; APPROVED members additionally require a membershipId.
UserSchema.index({ status: 1, membershipId: 1 });

module.exports = mongoose.model('User', UserSchema);