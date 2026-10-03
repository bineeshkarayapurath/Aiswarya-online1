const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  lowerPhone: { type: String, unique: true, sparse: true },
  email: { type: String, default: '' },
  membershipId: { type: String, index: { unique: true, sparse: true } },
  registrationNo: { type: String, default: '12 BTY 6652' },
  dob: { type: Date, required: true },
  age: { type: Number },
  address: { type: String, required: true },
  occupation: { type: String },
  education: { type: String },
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

  // Provenance of `role`. 'manual' = an admin explicitly assigned it via
  // set-role (never auto-revoked). 'designation' = derived automatically from
  // the Executive Committee designation, so losing the designation demotes the
  // account back to MEMBER. Defaults to 'manual' so pre-existing accounts keep
  // whatever an admin gave them.
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

  applicationPdfUrl: { type: String },
  idCardPdfUrl: { type: String },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectionReason: { type: String },

  // Phone verification (OTP via WhatsApp, Firebase Phone Auth, or a
    // club-office manual override).
  // default: undefined keeps firebaseUid OUT of the document until a real UID
  // exists, so the unique sparse index never collides on a '' placeholder and
  // multiple members without Firebase auth can coexist.
  firebaseUid: { type: String, index: { unique: true, sparse: true } },
  phoneVerified: { type: Boolean, default: false },
  phoneVerifiedVia: { type: String, enum: ['', 'firebase', 'sms', 'whatsapp', 'manual'], default: '' },

  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', function (next) {
  this.lowerPhone = (this.phoneNumber || '').replace(/\D/g, '');
  next();
});

// The home page stats strip counts APPROVED members and PENDING applications
// on every load, and status was unindexed — both countDocuments calls scanned
// the whole member roll. Leading with `status` serves the PENDING count on its
// own; APPPROVED members additionally require a membershipId.
UserSchema.index({ status: 1, membershipId: 1 });

module.exports = mongoose.model('User', UserSchema);