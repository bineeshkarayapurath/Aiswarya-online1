const config = require('../config/constants');
const BookIssue = require('../models/BookIssue');
const Book = require('../models/Book');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = [config.ISSUE_STATUS.ISSUED, config.ISSUE_STATUS.OVERDUE];

const normalizeKey = (v) => String(v || '').trim().toUpperCase();

// Whole (or partial) days between two dates, never negative.
const overdueDays = (issueDate, settleDate) => {
  const diff = new Date(settleDate).getTime() - new Date(issueDate).getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
};

// A book is "on loan" while its issue is in an active state.
const liveStockNumbers = async () => {
  const docs = await BookIssue.find({ status: { $in: ACTIVE_STATUSES } }).select(
    'book.stockNumber'
  );
  return new Set(docs.map((d) => d.book.stockNumber));
};

// Recompute overdue statuses + running fine for live loans. Runs on every
// list/read so the register is always current the moment the page opens.
const refreshLiveLoans = async (issues) => {
  const now = Date.now();
  const touched = [];
  for (const issue of issues) {
    if (!ACTIVE_STATUSES.includes(issue.status) || !issue.dueDate) continue;
    const days = overdueDays(issue.dueDate, now);
    const isOverdue = days > 0;
    const fine = isOverdue ? days * config.FINE_PER_DAY : 0;
    const status = isOverdue ? config.ISSUE_STATUS.OVERDUE : config.ISSUE_STATUS.ISSUED;
    if (issue.status !== status || issue.fineAmount !== fine) {
      issue.status = status;
      issue.fineAmount = fine;
      touched.push(issue.save());
    }
  }
  await Promise.all(touched);
};

exports.listIssues = async (req, res) => {
  try {
    const { status, q } = req.query;
    const filter = {};
    if (status === 'RETURNED') filter.status = config.ISSUE_STATUS.RETURNED;
    else if (status === 'ACTIVE') filter.status = { $in: ACTIVE_STATUSES };
    else if (status && status !== 'ALL') filter.status = status;

    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { 'member.memberName': rx },
        { 'member.memberId': rx },
        { 'book.title': rx },
        { 'book.stockNumber': rx },
        { 'book.author': rx },
      ];
    }

    const issues = await BookIssue.find(filter).sort({ issueDate: -1, createdAt: -1 });
    await refreshLiveLoans(issues);

    const summary = {
      active: 0,
      overdue: 0,
      returned: 0,
    };
    for (const i of issues) {
      if (i.status === config.ISSUE_STATUS.OVERDUE) summary.overdue += 1;
      else if (i.status === config.ISSUE_STATUS.RETURNED) summary.returned += 1;
      else summary.active += 1;
    }

    return res.json({ issues, summary });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Approved members for the issue autocomplete (Member ID / name / phone).
exports.searchMembers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = { status: config.STATUS.APPROVED, membershipId: { $ne: '' } };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ membershipId: rx }, { fullName: rx }, { phoneNumber: rx }];
    }
    const users = await User.find(filter)
      .select('membershipId fullName phoneNumber')
      .limit(15)
      .sort({ membershipId: 1 });
    const members = users
      .filter((u) => u.membershipId)
      .map((u) => ({ _id: u._id, membershipId: u.membershipId, fullName: u.fullName, phoneNumber: u.phoneNumber }));
    return res.json({ members });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Books that are in the catalog AND not currently on loan (Accession / Title).
exports.searchBooks = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ stockNumber: rx }, { title: rx }, { author: rx }];
    }
    const books = await Book.find(filter).limit(20).sort({ stockNumber: 1 });
    const taken = await liveStockNumbers();
    const available = books.filter((b) => !taken.has(b.stockNumber));
    return res.json({ books: available, count: available.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createIssue = async (req, res) => {
  try {
    const memberId = normalizeKey(req.body.memberId);
    const stockNumber = normalizeKey(req.body.stockNumber);
    if (!memberId) return res.status(400).json({ message: 'Choose the member' });
    if (!stockNumber) return res.status(400).json({ message: 'Choose the book' });

    const member = await User.findOne({ membershipId: memberId });
    if (!member) {
      return res.status(404).json({ message: `No member found with ID ${memberId}` });
    }
    if (member.status !== config.STATUS.APPROVED) {
      return res.status(400).json({ message: 'Only approved members can borrow books' });
    }

    const book = await Book.findOne({ stockNumber });
    if (!book) {
      return res.status(404).json({ message: `No book found with Accession No ${stockNumber}` });
    }

    const existing = await BookIssue.findOne({
      'book.stockNumber': stockNumber,
      status: { $in: ACTIVE_STATUSES },
    }).select('member dueDate status');
    if (existing) {
      return res.status(409).json({
        message: `"${book.title}" is already issued to ${existing.member.memberName} (due ${existing.dueDate.toLocaleDateString('en-IN')})`,
      });
    }

    const now = new Date();
    const dueDate = new Date(now.getTime() + config.LOAN_DAYS * DAY_MS);
    const issue = await BookIssue.create({
      member: { memberId, memberName: member.fullName },
      book: { stockNumber, title: book.title, author: book.author },
      issueDate: now,
      dueDate,
      status: config.ISSUE_STATUS.ISSUED,
      fineAmount: 0,
    });

    return res.status(201).json({ message: `Issued to ${member.fullName}`, issue });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This book is already on loan to another member' });
    }
    return res.status(500).json({ message: err.message });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const issue = await BookIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue record not found' });

    if (!ACTIVE_STATUSES.includes(issue.status)) {
      return res.status(400).json({ message: 'This book has already been returned' });
    }

    const returnDate = new Date();
    const days = issue.dueDate ? overdueDays(issue.dueDate, returnDate) : 0;
    issue.status = config.ISSUE_STATUS.RETURNED;
    issue.returnDate = returnDate;
    issue.fineAmount = days * config.FINE_PER_DAY;
    await issue.save();

    res.json({
      message:
        issue.fineAmount > 0
          ? `Returned. Fine ₹${issue.fineAmount} on ${days} overdue day${days === 1 ? '' : 's'}`
          : 'Book returned on time',
      issue,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.issueStats = async (req, res) => {
  try {
    const all = await BookIssue.find({});
    await refreshLiveLoans(all);
    const summary = { active: 0, overdue: 0, returned: 0, fineCollected: 0 };
    for (const i of all) {
      if (i.status === config.ISSUE_STATUS.RETURNED) {
        summary.returned += 1;
        summary.fineCollected += i.fineAmount || 0;
      } else if (i.status === config.ISSUE_STATUS.OVERDUE) {
        summary.overdue += 1;
        summary.active += 1;
      } else {
        summary.active += 1;
      }
    }
    return res.json({ summary });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};