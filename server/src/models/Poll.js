const mongoose = require('mongoose');

// One selectable answer on a poll. Votes are stored as member ids right on the
// option so a single document read yields the question, its options and the
// tallies, and a member can be checked for "already voted" without a second
// collection. A club poll has a few hundred voters at most, far below the
// document size that would make this the wrong shape.
const PollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    votes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { _id: true }
);

// A poll officers can publish and share with the club by WhatsApp. The short
// `slug` is what makes the shareable link pretty (/polls/ab12cd34) while the
// controller still accepts the raw document id, so an older link never breaks.
const PollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    options: { type: [PollOptionSchema], default: [] },

    slug: { type: String, unique: true, sparse: true, index: true },

    // When true a member may tick several options; otherwise exactly one.
    allowMultiple: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    // Optional close time. Once passed the poll is read-only even while active.
    closesAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

PollSchema.index({ isActive: 1, createdAt: -1 });

// A poll is closed when an officer has deactivated it or its close time passed.
PollSchema.methods.isClosed = function isClosed() {
  if (!this.isActive) return true;
  if (this.closesAt && new Date(this.closesAt).getTime() <= Date.now()) return true;
  return false;
};

module.exports = mongoose.model('Poll', PollSchema);
