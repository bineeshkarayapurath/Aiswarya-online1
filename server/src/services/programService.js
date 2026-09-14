const config = require('../config/constants');
const ProgramMinutes = require('../models/ProgramMinutes');
const Account = require('../models/Account');
const { publicUrl } = require('../utils/storage');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Accept Firebase/public URLs sent by the client (direct Storage upload) as a
// JSON array, comma-separated list, or already-parsed array.
function parsePhotoUrlList(raw) {
  if (!raw) return [];
  const clean = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : (() => {
    try {
      const a = JSON.parse(String(raw));
      return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
    } catch {
      return String(raw).split(',').map((s) => s.trim());
    }
  })();
  return clean.filter((u) => /^(https?:\/\/|\/uploads\/)/i.test(String(u)));
}

function toView(doc) {
  const o = doc.toObject();
  o._id = String(o._id);
  o.date = o.date ? new Date(o.date).toISOString() : null;
  o.minutesPhoto = publicUrl(o.minutesPhoto);
  o.attendanceSheetPhoto = publicUrl(o.attendanceSheetPhoto);
  o.eventPhotos = (o.eventPhotos || []).map(publicUrl);
  return o;
}

function parseFinance(payload) {
  let data = payload;
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload);
    } catch {
      data = null;
    }
  }
  const income = [];
  const expenses = [];
  if (Array.isArray(data?.income)) {
    data.income.forEach((e) => {
      const desc = String(e?.description || '').trim();
      const amt = Number(e?.amount);
      const pm = e?.paymentMode === 'Cash' ? 'Cash' : e?.paymentMode === 'Bank' ? 'Bank' : 'Bank';
      if (desc && Number.isFinite(amt) && amt > 0) income.push({ description: desc, amount: Math.round(amt * 100) / 100, paymentMode: pm });
    });
  }
  if (Array.isArray(data?.expenses)) {
    data.expenses.forEach((e) => {
      const desc = String(e?.description || '').trim();
      const amt = Number(e?.amount);
      const pm = e?.paymentMode === 'Cash' ? 'Cash' : e?.paymentMode === 'Bank' ? 'Bank' : 'Bank';
      if (desc && Number.isFinite(amt) && amt > 0) expenses.push({ description: desc, amount: Math.round(amt * 100) / 100, paymentMode: pm });
    });
  }
  const totalIncome = income.reduce((s, e) => s + e.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  return { income, expenses, totalIncome, totalExpense, netBalance: totalIncome - totalExpense };
}

async function syncAccounts({ programId, title, section, date, finance }) {
  const docs = [];
  finance.income.forEach((e) => {
    docs.push({
      type: 'Income',
      description: `Income - ${e.description} (${title})`,
      amount: e.amount,
      category: e.description,
      paymentMode: e.paymentMode || 'Bank',
      source: 'program',
      program: title,
      programId,
      section,
      date,
    });
  });
  finance.expenses.forEach((e) => {
    docs.push({
      type: 'Expense',
      description: `Expense - ${e.description} (${title})`,
      amount: e.amount,
      category: e.description,
      paymentMode: e.paymentMode || 'Bank',
      source: 'program',
      program: title,
      programId,
      section,
      date,
    });
  });
  if (!docs.length) return;
  await Account.deleteMany({ programId });
  await Account.insertMany(docs);
}

// Insert a program record. Financial entries are ONLY synced to the Main
// Accounts ledger when the record is created already-approved (admins).
async function insertProgram({ fields = {}, files = {}, status = 'APPROVED', submittedBy = null }) {
  const { title, date, section, minutesRichText, programDetails, participantCount, finance } = fields;
  const minutesPhoto =
    String(fields.minutesPhotoUrl || '').trim() ||
    (files.minutesPhoto?.[0] ? `photos/${files.minutesPhoto[0].filename}` : '');
  const attendanceSheetPhoto =
    String(fields.attendanceSheetPhotoUrl || '').trim() ||
    (files.attendanceSheetPhoto?.[0] ? `photos/${files.attendanceSheetPhoto[0].filename}` : '');
  let eventPhotos = parsePhotoUrlList(fields.eventPhotoUrls);
  if (!eventPhotos.length) {
    eventPhotos = (files.eventPhotos || []).map((f) => `photos/${f.filename}`);
  }
  const parsedFinance = parseFinance(finance);

  const doc = await ProgramMinutes.create({
    section,
    title: String(title).trim(),
    date: new Date(date),
    minutesRichText: String(minutesRichText || ''),
    minutesPhoto,
    programDetails: String(programDetails || ''),
    participantCount: parseInt(participantCount, 10) || 0,
    attendanceSheetPhoto,
    eventPhotos,
    finance: parsedFinance,
    status,
    submittedBy,
    approvedAt: status === 'APPROVED' ? new Date() : null,
  });

  if (status === 'APPROVED') {
    await syncAccounts({
      programId: doc._id,
      title: doc.title,
      section: doc.section,
      date: doc.date,
      finance: parsedFinance,
    });
  }

  return toView(doc);
}

// Admin approval: marks a pending submission APPROVED and syncs its finance
// to the Main Accounts ledger (published to the main registers).
async function approveProgram({ programId, approverId }) {
  const doc = await ProgramMinutes.findById(programId);
  if (!doc) throw new Error('Program not found');
  if (doc.status === 'APPROVED') return toView(doc);

  doc.status = 'APPROVED';
  doc.rejectionReason = '';
  doc.approvedAt = new Date();
  doc.approvedBy = approverId;
  await doc.save();

  await syncAccounts({
    programId: doc._id,
    title: doc.title,
    section: doc.section,
    date: doc.date,
    finance: doc.finance || {},
  });

  return toView(doc);
}

async function rejectProgram({ programId, reason }) {
  const doc = await ProgramMinutes.findById(programId);
  if (!doc) throw new Error('Program not found');
  doc.status = 'REJECTED';
  doc.rejectionReason = String(reason || '').trim();
  doc.approvedAt = null;
  await doc.save();
  return toView(doc);
}

async function queryPrograms({ section, year, q, allowMain = true, status }) {
  const filter = {};
  if (section && section !== 'All') filter.section = section;
  else if (!allowMain) filter.section = { $in: config.OFFICIABLE_SECTIONS };
  if (year && /^\d{4}$/.test(String(year))) {
    filter.date = {
      $gte: new Date(`${year}-01-01T00:00:00.000Z`),
      $lte: new Date(`${year}-12-31T23:59:59.999Z`),
    };
  }
  if (q && String(q).trim()) {
    filter.title = { $regex: escapeRegex(String(q).trim()), $options: 'i' };
  }
  if (status && ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(status)) {
    filter.status = status;
  }
  const docs = await ProgramMinutes.find(filter)
    .populate('submittedBy', 'fullName phoneNumber')
    .sort({ date: -1 });
  return docs.map(toView);
}

module.exports = { insertProgram, approveProgram, rejectProgram, queryPrograms, parseFinance, parsePhotoUrlList, toView };