const mongoose = require('mongoose');

// A book a member would like the library to buy for the Book Festival / next
// acquisition. Members submit these themselves; the committee reviews them and
// moves each one through Pending -> Approved -> Procured.
//
// The form is admin-configurable (see BookRequestConfig), so a submission is
// stored as a list of { id, label, value } answers rather than fixed columns.
// The label is captured at submit time so a request still reads correctly after
// the field list is later renamed or reordered.
//
// The list is shown publicly (inside the club and on the website) so members can
// see what has already been asked for and avoid duplicate requests. That is why
// the requester's name and membership ID are denormalised here instead of being
// left as a bare reference: the list must still read correctly even if the
// account is later deleted or its name changes.
const AnswerSchema = new mongoose.Schema(
  {
    id: { type: String, default: '', trim: true },
    label: { type: String, default: '', trim: true },
    value: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const BookRequestSchema = new mongoose.Schema(
  {
    answers: { type: [AnswerSchema], default: [] },

    // Lower-cased blob of every answer plus the requester, so the shared list can
    // be searched without regex-scanning an array of subdocuments.
    searchText: { type: String, default: '' },

    // Retained for records created before the form was configurable. New records
    // leave these empty and are read from `answers` (see controller.answersFor).
    bookTitle: { type: String, default: '', trim: true },
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
