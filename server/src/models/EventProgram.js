const mongoose = require('mongoose');

const SubProgramSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isGroup: { type: Boolean, default: false },
    maxParticipants: { type: Number, default: 0 },
    description: { type: String, default: '' },
  },
  { _id: true }
);

// Two program shapes share this collection:
//   type 'single' — ONE competition / program (e.g. "Women's Reading
//     Competition"). Admins set a registration window + program date and a
//     description; members register straight against the program with their
//     Member ID. There are no sub-programs.
//   type 'multi'  — a headline event (e.g. "Christmas Competitions") holding
//     many sub-programs / items (Dance, Song, Drama…), each of which may be a
//     group item. Members pick the item from a dropdown to register.
const EventProgramSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['single', 'multi'], default: 'multi', index: true },
    name: { type: String, required: true, trim: true },
    targetAudience: {
      type: String,
      enum: ['Balavedi', 'Vanithavedi', 'Library members', 'Open to All'],
      default: 'Open to All',
      index: true,
    },
    isRegistrationOpen: { type: Boolean, default: false, index: true },
    // Registration window. When a start and/or close date is set, registration
    // is only accepted inside the window; when both are unset the manual
    // isRegistrationOpen toggle alone decides.
    registrationStartDate: { type: Date },
    registrationEndDate: { type: Date },
    programDate: { type: Date },
    subPrograms: { type: [SubProgramSchema], default: [] },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

EventProgramSchema.index({ name: 1 });
EventProgramSchema.index({ isRegistrationOpen: 1, targetAudience: 1 });

module.exports = mongoose.model('EventProgram', EventProgramSchema);
