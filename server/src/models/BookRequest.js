const mongoose = require('mongoose');

// A book a member would like the library to buy for the Book Festival / next
// acquisition. Members submit these themselves; the committee reviews them and
// moves each one through Pending -> Approved -> Procured.
//
// The list is shown publicly (inside the club and on the website) so members can
// see what has already been asked for and avoid duplicate requests. That is why
// the requester's name and membership ID are denormalised here instead of being
// left as a bare reference: the list must still read correctly even if the
// account is later deleted or its name changes.
const BookRequestSchema = new mongoose.Schema(
  {
    bookTitle: { type: String, required: true, trim: true },
    author: { type: String, default: '', trim: true },
    language: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    memberName: { type: String, default: '', trim: true },
    membershipId: { type: String, default: '', trim: true },

    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Procured'],
      default: 'Pending',
      index: true,
    },
  },
  { timestamps: true }
);

BookRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BookRequest', BookRequestSchema);
