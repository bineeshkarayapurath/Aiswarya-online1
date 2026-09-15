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
    enum: ['MEMBER', 'SUPER_ADMIN'],
    default: 'MEMBER',
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
  },

  applicationPdfUrl: { type: String },
  idCardPdfUrl: { type: String },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectionReason: { type: String },

  // Phone verification (SMS/OTP via Fast2SMS, Firebase Phone Auth, or a
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

module.exports = mongoose.model('User', UserSchema);