const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { publicUrl } = require('../utils/storage');
const { generateApplicationPdf, generateIdCardPdf } = require('../services/pdfService');

// Compute the next membership ID (AISC-001, AISC-002, ...) from the number of
// approved members so the sequence always continues from the last assigned ID.
// A uniqueness check bumps past any gap left by removed members.
async function nextMembershipId() {
  const count = await User.countDocuments({
    status: config.STATUS.APPROVED,
    membershipId: { $exists: true, $nin: ['', null] },
  });
  let seq = count + 1;
  let id = `${config.MEMBERSHIP_PREFIX}-${String(seq).padStart(3, '0')}`;
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({ membershipId: id })) {
    seq += 1;
    id = `${config.MEMBERSHIP_PREFIX}-${String(seq).padStart(3, '0')}`;
  }
  return id;
}

// Guarantee an approved member carries a sequential, strictly-unique membership
// ID (e.g. AISC-001, AISC-002). Approved records that were created before ID
// assignment (legacy / direct ADMIN accounts) are backfilled on read instead of
// ever surfacing a blank placeholder or a raw MongoDB ObjectId.
async function ensureMembershipId(user) {
  if (!user) return '';
  if (user.membershipId) return user.membershipId;
  if (user.status !== config.STATUS.APPROVED) return '';
  user.membershipId = await nextMembershipId();
  await user.save();
  return user.membershipId;
}

exports.listRequests = async (req, res) => {
  try {
    const status = req.query.status || 'PENDING_APPROVAL';
    const users = await User.find({ status }).sort({ createdAt: -1 });
    const items = users.map((u) => ({
      _id: u._id,
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      membershipId: u.membershipId,
      dob: u.dob,
      age: u.age,
      address: u.address,
      occupation: u.occupation,
      education: u.education,
      photoUrl: u.photoUrl ? publicUrl(u.photoUrl) : '',
      recommender: u.recommender,
      status: u.status,
      role: u.role,
      createdAt: u.createdAt,
      phoneVerified: u.phoneVerified,
      phoneVerifiedVia: u.phoneVerifiedVia,
      firebaseUid: u.firebaseUid || '',
    }));
    return res.json({ requests: items });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Approved members list. Photo URLs are normalised to fully-qualified public
// URLs so the Approved Members table in the Authority Dashboard renders photos
// regardless of how they were stored (relative /uploads/... vs CDN).
exports.listAll = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: [config.ROLES.MEMBER, config.ROLES.ADMIN] },
    }).sort({ createdAt: -1 });
    const view = [];
    for (const u of users) {
      await ensureMembershipId(u);
      const obj = u.toObject();
      delete obj.lowerPhone;
      obj.photoUrl = obj.photoUrl ? publicUrl(obj.photoUrl) : '';
      if (obj.applicationPdfUrl) obj.applicationPdfUrl = publicUrl(obj.applicationPdfUrl);
      if (obj.idCardPdfUrl) obj.idCardPdfUrl = publicUrl(obj.idCardPdfUrl);
      view.push(obj);
    }
    return res.json({ users: view });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.editRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, dob, address, occupation, education, recommenderName, recommenderMemberId, email } =
      req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName) user.fullName = fullName;
    if (dob) {
      user.dob = new Date(dob);
      user.age = Math.floor(
        (Date.now() - user.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }
    if (address) user.address = address;
    if (occupation !== undefined) user.occupation = occupation;
    if (education !== undefined) user.education = education;
    if (email !== undefined) user.email = email;
    if (recommenderName !== undefined || recommenderMemberId !== undefined) {
      user.recommender = {
        name: recommenderName !== undefined ? recommenderName : (user.recommender.name || ''),
        memberId: recommenderMemberId !== undefined ? recommenderMemberId : (user.recommender.memberId || ''),
      };
    }
    await user.save();
    return res.json({ message: 'Updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { manualVerify } = req.body || {};
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status === config.STATUS.APPROVED) {
      return res.status(400).json({ message: 'Already approved' });
    }

    // If the applicant never completed OTP verification, the
    // admin must explicitly mark Manual Verification to approve the phone.
    const bypassOtp = manualVerify === true || manualVerify === 'true';
    if (!user.phoneVerified && !bypassOtp) {
      return res.status(400).json({
        message: 'Applicant phone is not verified. Enable Manual Verification to approve.',
      });
    }
    if (!user.phoneVerified) {
      user.phoneVerified = true;
      user.phoneVerifiedVia = 'manual';
    }

    // Only allocate a membership number if the applicant doesn't already have
    // one (e.g. a re-approved member keeps their existing ID).
    if (!user.membershipId) {
      user.membershipId = await nextMembershipId();
    }
    user.status = config.STATUS.APPROVED;
    user.approvedBy = req.user.fullName;
    user.approvedAt = new Date();
    await user.save();

    // Generate PDFs (non-blocking but we await so API reports success)
    let applicationPdfPath = '';
    let idCardPdfPath = '';
    try {
      const ap = await generateApplicationPdf(user, {
        approvedBy: user.approvedBy,
        approvedAt: user.approvedAt,
      });
      applicationPdfPath = publicUrl(path.relative(config.STORAGE_DIR, ap));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Application PDF error', e);
    }
    try {
      const ic = await generateIdCardPdf(user);
      idCardPdfPath = publicUrl(path.relative(config.STORAGE_DIR, ic));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('ID Card PDF error', e);
    }

    user.applicationPdfUrl = applicationPdfPath;
    user.idCardPdfUrl = idCardPdfPath;
    await user.save();

    const userObj = user.toObject();
    delete userObj.lowerPhone;

    return res.json({
      message: 'Approved and documents generated',
      user: userObj,
      membershipId: user.membershipId,
      applicationPdfUrl: applicationPdfPath,
      idCardPdfUrl: idCardPdfPath,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.status = config.STATUS.REJECTED;
    user.rejectionReason = reason || '';
    await user.save();
    return res.json({ message: 'Rejected' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// List members assigned to a committee (by committeeName), with their designation.
exports.listCommitteeMembers = async (req, res) => {
  try {
    const { committee } = req.query;
    if (!committee) {
      return res.status(400).json({ message: 'committee is required' });
    }
    const users = await User.find({ 'subCommittees.committeeName': committee }).sort({
      createdAt: -1,
    });
    const members = users
      .map((u) => {
        const assignment = u.subCommittees.find((s) => s.committeeName === committee);
        if (!assignment) return null;
        return {
          _id: u._id,
          membershipId: u.membershipId || '—',
          fullName: u.fullName,
          phoneNumber: u.phoneNumber,
          role: assignment.role,
          isExecutive: assignment.isExecutive,
        };
      })
      .filter(Boolean);
    return res.json({ members });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Assign a member (by membership ID) to a committee with a designation.
exports.assignCommitteeMember = async (req, res) => {
  try {
    const { committeeName, membershipId, role } = req.body;
    if (!committeeName || !membershipId || !role) {
      return res.status(400).json({ message: 'committeeName, membershipId and role are required' });
    }
    const validCommittee = Object.values(config.COMMITTEES).includes(committeeName);
    if (!validCommittee) {
      return res.status(400).json({ message: 'Invalid committee' });
    }
    if (!config.COMMITTEE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid designation' });
    }

    const id = String(membershipId).trim().toUpperCase();
    const user = await User.findOne({ membershipId: id });
    if (!user) {
      return res.status(404).json({ message: `No member found with ID ${id}` });
    }
    if (user.status !== config.STATUS.APPROVED) {
      return res.status(400).json({ message: 'Only approved members can be assigned to committees' });
    }

    const isExecutive = config.EXECUTIVE_ROLES.includes(role);
    const existing = user.subCommittees.find((s) => s.committeeName === committeeName);
    if (existing) {
      existing.role = role;
      existing.isExecutive = isExecutive;
    } else {
      user.subCommittees.push({ committeeName, role, isExecutive });
    }
    await user.save();

    return res.json({
      message: `${user.fullName} added to ${committeeName} as ${role}`,
      member: {
        _id: user._id,
        membershipId: user.membershipId,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role,
        isExecutive,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Remove a member from a committee.
exports.removeCommitteeMember = async (req, res) => {
  try {
    const { committeeName, membershipId } = req.body;
    if (!committeeName || !membershipId) {
      return res.status(400).json({ message: 'committeeName and membershipId are required' });
    }
    const id = String(membershipId).trim().toUpperCase();
    const user = await User.findOne({ membershipId: id });
    if (!user) {
      return res.status(404).json({ message: `No member found with ID ${id}` });
    }
    user.subCommittees = user.subCommittees.filter((s) => s.committeeName !== committeeName);
    await user.save();
    return res.json({ message: `${user.fullName} removed from ${committeeName}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ------------------------------------------------------------------ *
 *  Executive Committee (Main) — designation management
 * ------------------------------------------------------------------ */
function execMemberView(u) {
  return {
    _id: u._id,
    membershipId: u.membershipId || '—',
    fullName: u.fullName,
    phoneNumber: u.phoneNumber,
    email: u.email || '',
    photoUrl: u.photoUrl ? publicUrl(u.photoUrl) : '',
    designation: u.designation || '',
    designationUpdatedAt: u.designationUpdatedAt || null,
    status: u.status,
    role: u.role,
  };
}

// Full Executive Committee roster: every approved member plus the
// designation they currently hold ('' = General Member).
exports.listExecutiveCommittee = async (req, res) => {
  try {
    const users = await User.find({
      status: config.STATUS.APPROVED,
      $or: [{ role: config.ROLES.MEMBER }, { designation: { $exists: true, $nin: ['', null] } }],
    }).sort({ designation: -1, membershipId: 1 });
    for (const u of users) await ensureMembershipId(u);
    const members = users.filter((u) => u.membershipId).map(execMemberView);
    const summary = {
      total: members.length,
      designated: members.filter((m) => m.designation).length,
    };
    return res.json({ members, summary });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Autocomplete for the Member ID search box. Includes status + photo so the
// picker can surface a member's current approval state at a glance.
exports.searchCommitteeMembers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = {
      status: config.STATUS.APPROVED,
      $or: [{ role: config.ROLES.MEMBER }, { designation: { $exists: true, $nin: ['', null] } }],
    };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ membershipId: rx }, { fullName: rx }, { phoneNumber: rx }];
    }
    const users = await User.find(filter)
      .select('membershipId fullName phoneNumber photoUrl designation status')
      .limit(12)
      .sort({ designation: -1, membershipId: 1 });
    const members = users.filter((u) => u.membershipId).map(execMemberView);
    return res.json({ members });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Assign / update a member's Executive Committee designation. An empty
// designation resets the member to "General Member".
exports.setDesignation = async (req, res) => {
  try {
    const { membershipId, designation } = req.body;
    const id = String(membershipId || '').trim().toUpperCase();
    if (!id) return res.status(400).json({ message: 'Member ID is required' });

    const next = String(designation || '').trim();
    if (next && !config.DESIGNATION_ROLES.includes(next)) {
      return res
        .status(400)
        .json({ message: `Invalid designation. Choose from ${config.DESIGNATION_ROLES.join(', ')}` });
    }

    const user = await User.findOne({ membershipId: id });
    if (!user) return res.status(404).json({ message: `No member found with ID ${id}` });
    if (user.status !== config.STATUS.APPROVED) {
      return res.status(400).json({ message: 'Only approved members can hold committee designations' });
    }

    user.designation = next;
    user.designationUpdatedAt = next ? new Date() : null;
    await user.save();

    return res.json({
      message: next ? `${user.fullName} is now ${next}` : `${user.fullName} is now a General Member`,
      member: execMemberView(user),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Assign / update a user's top-level role (MEMBER / ADMIN). Only an admin
// may perform this action.  Setting role to ADMIN grants the same
// privileges as SUPER_ADMIN (full dashboard access, approvals, designation
// management).
exports.setRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }
    const validRoles = [config.ROLES.MEMBER, config.ROLES.ADMIN];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: `Invalid role. Allowed: ${validRoles.join(', ')}` });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === config.ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot modify a SUPER_ADMIN role' });
    }
    if (user.status !== config.STATUS.APPROVED) {
      return res.status(400).json({ message: 'Only approved members can be assigned a role' });
    }
    user.role = role;
    await user.save();
    return res.json({
      message: `${user.fullName} is now ${role}`,
      user: { _id: user._id, role: user.role, designation: user.designation || '', status: user.status },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await ensureMembershipId(user);
    const obj = user.toObject();
    delete obj.lowerPhone;
    if (obj.photoUrl) obj.photoUrl = publicUrl(obj.photoUrl);
    if (obj.applicationPdfUrl) obj.applicationPdfUrl = publicUrl(obj.applicationPdfUrl);
    if (obj.idCardPdfUrl) obj.idCardPdfUrl = publicUrl(obj.idCardPdfUrl);
    return res.json({ user: obj });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Update a registered member's details from the Approved Members table,
// including photoUrl and membershipId. Membership IDs are kept strictly unique
// (duplicate attempts are rejected); cleared IDs on approved accounts are
// re-generated sequentially instead of leaving a gap.
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === config.ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot edit a SUPER_ADMIN account' });
    }

    const body = req.body || {};

    if (body.membershipId !== undefined) {
      const next = String(body.membershipId).trim().toUpperCase();
      if (next) {
        const clash = await User.findOne({ membershipId: next, _id: { $ne: user._id } });
        if (clash) {
          return res.status(400).json({ message: `Member ID ${next} is already assigned` });
        }
        user.membershipId = next;
      } else if (user.status === config.STATUS.APPROVED) {
        user.membershipId = await nextMembershipId();
      } else {
        user.membershipId = '';
      }
    }

    if (body.fullName !== undefined) user.fullName = body.fullName;
    if (body.dob) {
      user.dob = new Date(body.dob);
      user.age = Math.floor((Date.now() - user.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    if (body.phoneNumber !== undefined) {
      const phone = String(body.phoneNumber).trim();
      if (phone) {
        const clash = await User.findOne({ phoneNumber: phone, _id: { $ne: user._id } });
        if (clash) {
          return res.status(400).json({ message: 'This phone number belongs to another member' });
        }
        user.phoneNumber = phone;
      }
    }
    if (body.email !== undefined) user.email = body.email;
    if (body.address !== undefined) user.address = body.address;
    if (body.occupation !== undefined) user.occupation = body.occupation;
    if (body.education !== undefined) user.education = body.education;
    if (body.photoUrl !== undefined) user.photoUrl = body.photoUrl;

    await user.save();

    const obj = user.toObject();
    delete obj.lowerPhone;
    if (obj.photoUrl) obj.photoUrl = publicUrl(obj.photoUrl);
    if (obj.applicationPdfUrl) obj.applicationPdfUrl = publicUrl(obj.applicationPdfUrl);
    if (obj.idCardPdfUrl) obj.idCardPdfUrl = publicUrl(obj.idCardPdfUrl);
    return res.json({ message: 'Member updated', user: obj });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function removeStoredFile(relativePath) {
  if (!relativePath) return;
  const rel = String(relativePath).replace(/^\/uploads\//, '');
  const abs = path.resolve(config.STORAGE_DIR, rel);
  if (abs.startsWith(config.STORAGE_DIR) && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('cleanup error', e);
    }
  }
}

// Hard-delete a member so the same phone number can be re-registered fresh.
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === config.ROLES.SUPER_ADMIN || user.role === config.ROLES.ADMIN) {
      return res.status(403).json({ message: 'Cannot delete an authority account' });
    }

    ['photoUrl', 'applicationPdfUrl', 'idCardPdfUrl'].forEach((k) =>
      removeStoredFile(user[k])
    );

    await User.findByIdAndDelete(id);
    return res.json({ message: 'Member record deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Dev-only helper: wipe every demo member, reset the ID counter, and clear stored files.
exports.clearMembers = async (req, res) => {
  if (config.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Not available in production' });
  }
  try {
    const result = await User.deleteMany({ role: config.ROLES.MEMBER });

    await Counter.findOneAndUpdate({ key: 'membership' }, { seq: 0 }, { upsert: true });

    ['photos', 'pdfs', 'qr'].forEach((dirName) => {
      const dir = path.join(config.STORAGE_DIR, dirName);
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        try {
          fs.unlinkSync(fp);
        } catch (e) {
          // ignore
        }
      }
    });

    return res.json({
      message: 'All demo members cleared',
      deleted: result.deletedCount,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};