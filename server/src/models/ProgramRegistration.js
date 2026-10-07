const mongoose = require('mongoose');
const { getNextSequence } = require('./Counter');

// A person attached to a group entry. Only the name is required; the rest is
// captured when the group is entered by a registered member.
const TeamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, default: '' },
    membershipId: { type: String, default: '' },
  },
  { _id: false }
);

// One entry in the New Year 2027 Annual Celebration program register. Covers
// both a solo participant and a group/team (Drama, Group Dance, ...), and is
// filled either by a signed-in member (auto-linked to their account) or by a
// member of the public with no account at all.
const ProgramRegistrationSchema = new mongoose.Schema(
  {
    // Participant name for a solo entry, or the team's name for a group entry.
    participantName: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    itemTitle: { type: String, required: true, trim: true },

    isGroup: { type: Boolean, default: false },
    // The lead person's full details. For a group entry this is required by the
    // controller; for a solo entry it mirrors the participant.
    lead: {
      name: { type: String, default: '' },
      phoneNumber: { type: String, default: '' },
      email: { type: String, default: '' },
      membershipId: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    // Other participating team members (names, plus phone/ID when known).
    members: { type: [TeamMemberSchema], default: [] },

    // Linked member account, when the entry was made by / matched to a member.
    // Kept nullable so public registrations need no account.
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    membershipId: { type: String, default: '', index: true },

    // Automatically assigned, globally unique chest number (e.g. NY27-001).
    chestNumber: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ['REGISTERED', 'CANCELLED'],
      default: 'REGISTERED',
      index: true,
    },
  },
  { timestamps: true }
);

ProgramRegistrationSchema.index({ category: 1, chestNumber: 1 });

// Mint the next chest number. The counter is shared across every category, so
// the numbers stay unique club-wide and readable on the notice board.
async function nextChestNumber(prefix = 'NY27') {
  const seq = await getNextSequence('program_registration_chest');
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

ProgramRegistrationSchema.statics.nextChestNumber = nextChestNumber;

module.exports = mongoose.model('ProgramRegistration', ProgramRegistrationSchema);
module.exports.nextChestNumber = nextChestNumber;
