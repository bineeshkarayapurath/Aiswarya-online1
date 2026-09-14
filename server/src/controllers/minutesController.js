const config = require('../config/constants');
const ProgramMinutes = require('../models/ProgramMinutes');
const { insertProgram, approveProgram, rejectProgram, queryPrograms, toView } = require('../services/programService');

exports.listPrograms = async (req, res) => {
  try {
    const { section, year, q, status } = req.query;
    const programs = await queryPrograms({ section, year, q, allowMain: true, status });
    return res.json({ programs });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getProgram = async (req, res) => {
  try {
    const doc = await ProgramMinutes.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Program not found' });
    return res.json({ program: toView(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Admin approves a pending sub-committee submission (approve + sync to ledger).
exports.approveProgram = async (req, res) => {
  try {
    const program = await approveProgram({ programId: req.params.id, approverId: req.user._id });
    return res.json({ message: 'Program approved and synced to main accounts', program });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Admin rejects a pending sub-committee submission with remarks.
exports.rejectProgram = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Rejection reason/remarks are required' });
    }
    const program = await rejectProgram({ programId: req.params.id, reason });
    return res.json({ message: 'Program rejected', program });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createProgram = async (req, res) => {
  try {
    const { title, date, section, minutesRichText, programDetails, participantCount, finance, minutesPhotoUrl, attendanceSheetPhotoUrl, eventPhotoUrls } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Program/meeting name is required' });
    }
    if (!date) {
      return res.status(400).json({ message: 'Program date is required' });
    }
    if (!config.SECTIONS.includes(section)) {
      return res.status(400).json({ message: 'Invalid section' });
    }

    const program = await insertProgram({
      fields: { title, date, section, minutesRichText, programDetails, participantCount, finance, minutesPhotoUrl, attendanceSheetPhotoUrl, eventPhotoUrls },
      files: req.files || {},
      status: 'APPROVED',
      submittedBy: null,
    });

    return res.status(201).json({ program });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};