const mongoose = require('mongoose');
const { getNextSequence } = require('./Counter');

const ParticipantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    membershipId: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
  },
  { _id: false }
);

const EventRegistrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'EventProgram', required: true, index: true },
    subProgram: { type: mongoose.Schema.Types.ObjectId, required: true },
    subProgramName: { type: String, default: '', trim: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    membershipId: { type: String, default: '', index: true },
    participantName: { type: String, required: true, trim: true },
    contactNumber: { type: String, default: '', trim: true },
    isGroup: { type: Boolean, default: false },
    leadName: { type: String, default: '', trim: true },
    otherParticipants: { type: [ParticipantSchema], default: [] },
    chestNumber: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['REGISTERED', 'CANCELLED'], default: 'REGISTERED', index: true },
  },
  { timestamps: true }
);

EventRegistrationSchema.index({ event: 1, subProgram: 1 });
EventRegistrationSchema.index({ member: 1 });

async function nextChestNumber(prefix = 'EVT') {
  const seq = await getNextSequence('event_registration_chest');
  return prefix + '-' + String(seq).padStart(4, '0');
}

EventRegistrationSchema.statics.nextChestNumber = nextChestNumber;

module.exports = mongoose.model('EventRegistration', EventRegistrationSchema);
module.exports.nextChestNumber = nextChestNumber;
