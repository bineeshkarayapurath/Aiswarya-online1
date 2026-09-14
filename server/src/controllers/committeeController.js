const config = require('../config/constants');
const User = require('../models/User');
const ProgramMinutes = require('../models/ProgramMinutes');
const { insertProgram, queryPrograms, toView } = require('../services/programService');

function officiatedCommittees(user) {
  return (user.subCommittees || []).filter(
    (s) => config.OFFICIABLE_SECTIONS.includes(s.committeeName) && config.OFFICER_ROLES.includes(s.role)
  );
}

// My sub-committee assignments + full directory for any committee where I am President/Secretary.
exports.myCommitteeDashboard = async (req, res) => {
  try {
    const user = req.user;
    const myAssignments = (user.subCommittees || []).map((s) => ({
      committeeName: s.committeeName,
      role: s.role,
      isExecutive: s.isExecutive,
    }));
    const officiated = officiatedCommittees(user);

    const directories = {};
    for (const c of officiated) {
      const members = await User.find({ 'subCommittees.committeeName': c.committeeName }).sort({
        membershipId: 1,
      });
      directories[c.committeeName] = members
        .map((u) => {
          const assignment = u.subCommittees.find((s) => s.committeeName === c.committeeName);
          if (!assignment) return null;
          return {
            membershipId: u.membershipId || '—',
            fullName: u.fullName,
            role: assignment.role,
            phoneNumber: u.phoneNumber,
            email: u.email || '—',
          };
        })
        .filter(Boolean);
    }

    return res.json({
      myAssignments,
      officiated: officiated.map((c) => ({ committeeName: c.committeeName, role: c.role })),
      directories,
      canManage: officiated.length > 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// List program registers uniquely for the committees the user officiates.
exports.listMyPrograms = async (req, res) => {
  try {
    const officiated = officiatedCommittees(req.user);
    if (officiated.length === 0) {
      return res.status(403).json({ message: 'Only committee Presidents/Secretaries can access program registers' });
    }
    const { section, year, q, status } = req.query;
    const allowedSections = officiated.map((c) => c.committeeName);
    let sectionFilter = section;
    if (!section || section === 'All') {
      sectionFilter = undefined;
    }
    const programs = await queryPrograms({ section: sectionFilter, year, q, allowMain: true, status });
    const scoped = programs.filter((p) => allowedSections.includes(p.section));
    return res.json({ programs: scoped });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Record a program register for one of the user's own committees only.
// Set to PENDING_APPROVAL and do NOT sync finance until admin approves.
exports.createMyProgram = async (req, res) => {
  try {
    const { title, date, section, minutesRichText, programDetails, participantCount, finance, minutesPhotoUrl, attendanceSheetPhotoUrl, eventPhotoUrls } = req.body;
    const officiated = officiatedCommittees(req.user);
    if (officiated.length === 0) {
      return res.status(403).json({ message: 'Only committee Presidents/Secretaries can record program registers' });
    }
    const allowedSections = officiated.map((c) => c.committeeName);
    if (!section || !allowedSections.includes(section)) {
      return res.status(403).json({ message: 'You can only record registers for your own sub-committee' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Program/meeting name is required' });
    }
    if (!date) {
      return res.status(400).json({ message: 'Program date is required' });
    }

    const program = await insertProgram({
      fields: { title, date, section, minutesRichText, programDetails, participantCount, finance, minutesPhotoUrl, attendanceSheetPhotoUrl, eventPhotoUrls },
      files: req.files || {},
      status: 'PENDING_APPROVAL',
      submittedBy: req.user._id,
    });

    return res.status(201).json({ program });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Official edits + re-submits a REJECTED program entry for their own committee.
exports.resubmitProgram = async (req, res) => {
  try {
    const { title, date, minutesRichText, programDetails, participantCount, finance } = req.body;
    const programDoc = await ProgramMinutes.findById(req.params.id);
    if (!programDoc) return res.status(404).json({ message: 'Program not found' });

    if (String(programDoc.submittedBy?._id || programDoc.submittedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only re-submit your own submissions' });
    }
    if (programDoc.status !== 'REJECTED') {
      return res.status(400).json({ message: 'Only rejected entries can be re-submitted' });
    }

    const officiated = officiatedCommittees(req.user);
    if (!officiated.some((c) => c.committeeName === programDoc.section)) {
      return res.status(403).json({ message: 'You do not officiate this committee anymore' });
    }

    if (title) programDoc.title = String(title).trim();
    if (date) programDoc.date = new Date(date);
    if (minutesRichText !== undefined) programDoc.minutesRichText = String(minutesRichText || '');
    if (programDetails !== undefined) programDoc.programDetails = String(programDetails || '');
    if (participantCount) programDoc.participantCount = parseInt(participantCount, 10) || 0;
    if (finance) {
      const { parseFinance } = require('../services/programService');
      programDoc.finance = parseFinance(finance);
    }

    const files = req.files || {};
    const parsePhotoUrlList = require('../services/programService').parsePhotoUrlList;
    const minutesUrl = String(req.body.minutesPhotoUrl || '').trim();
    if (minutesUrl) programDoc.minutesPhoto = minutesUrl;
    else if (files.minutesPhoto?.[0]) programDoc.minutesPhoto = `photos/${files.minutesPhoto[0].filename}`;
    const attendanceUrl = String(req.body.attendanceSheetPhotoUrl || '').trim();
    if (attendanceUrl) programDoc.attendanceSheetPhoto = attendanceUrl;
    else if (files.attendanceSheetPhoto?.[0]) {
      programDoc.attendanceSheetPhoto = `photos/${files.attendanceSheetPhoto[0].filename}`;
    }
    const eventUrls = parsePhotoUrlList(req.body.eventPhotoUrls);
    if (eventUrls.length) programDoc.eventPhotos = eventUrls;
    else if (files.eventPhotos?.length) {
      programDoc.eventPhotos = files.eventPhotos.map((f) => `photos/${f.filename}`);
    }

    programDoc.status = 'PENDING_APPROVAL';
    programDoc.rejectionReason = '';
    programDoc.approvedAt = null;
    await programDoc.save();

    return res.json({ message: 'Entry re-submitted for approval', program: toView(programDoc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};