const mongoose = require('mongoose');

const BookIssueSchema = new mongoose.Schema(
  {
    member: {
      memberId: { type: String, required: true, index: true, trim: true },
      memberName: { type: String, required: true, trim: true },
    },
    book: {
      stockNumber: { type: String, required: true, trim: true },
      title: { type: String, required: true, trim: true },
      author: { type: String, default: '', trim: true },
    },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    returnDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ISSUED', 'RETURNED', 'OVERDUE'],
      default: 'ISSUED',
    },
    fineAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A book can only have one live loan at a time. The partial unique index
// guarantees it at the database level even if two clerks submit at once.
BookIssueSchema.index(
  { 'book.stockNumber': 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['ISSUED', 'OVERDUE'] },
    },
  }
);

module.exports = mongoose.model('BookIssue', BookIssueSchema);