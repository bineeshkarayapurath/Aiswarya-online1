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

const EventProgramSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    targetAudience: {
      type: String,
      enum: ['Balavedi', 'Vanithavedi', 'Library members', 'Open to All'],
      default: 'Open to All',
      index: true,
    },
    isRegistrationOpen: { type: Boolean, default: false, index: true },
    subPrograms: { type: [SubProgramSchema], default: [] },
    description: { type: String, default: '' },
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

EventProgramSchema.index({ name: 1 });
EventProgramSchema.index({ isRegistrationOpen: 1, targetAudience: 1 });

module.exports = mongoose.model('EventProgram', EventProgramSchema);
