const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { publicUrl } = require('../utils/storage');
const { generateApplicationPdf, generateIdCardPdf } = require('../services/pdfService');
const { effectiveRole, authorizedExecId, resyncDesignationRoles } = require('../services/roleService');
const { ensureMembershipId, nextMembershipId } = require('../services/membershipService');
const publicCache = require('../services/publicCache');

exports.listRequests = async (req, res) => {
  try {
    const status = req.query.status || 'PENDING_APPROVAL';
    const users = await User.find({ status }).sort({ createdAt: -1 });
    const authExecId = await authorizedExecId();
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
      designation: u.designation || '',
      // Effective, not stored, so a freshly designated President / Secretary is
      // already recognised as ADMIN by the approvals screen.
      role: effectiveRole(u, authExecId),
      createdAt: u.createdAt,
    }));
    return res.json({ requests: items });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Approved members list. Photo URLs are normalised to fully-qualified public
// URLs so the Approved Members table in the Authority Dashboard renders photos
// regardless of how they were stored (relative /uploads/... vs CDN).
// `role` is reported through effectiveRole() so a President / Secretary (and the
// single authorised Executive Committee Member) shows as ADMIN here immediately,
// without waiting for their next login to persist the auto-grant (and without
// writing on every list request).
exports.listAll = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: [config.ROLES.MEMBER, config.ROLES.ADMIN] },
    }).sort({ createdAt: -1 });
    const authExecId = await authorizedExecId();
    const view = [];
    for (const u of users) {
      await ensureMembershipId(u);
      const obj = u.toObject();
      delete obj.lowerPhone;
      obj.role = effectiveRole(obj, authExecId);
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
    // Corrections reach an approved member too (the detail dialog edits through
    // this route), so any documents already generated are rebuilt from the
    // record that was just saved rather than keeping the old details.
    await refreshGeneratedDocuments(user);
    return res.json({ message: 'Updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status === config.STATUS.APPROVED) {
      return res.status(400).json({ message: 'Already approved' });
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

    // Approving moves an applicant from PENDING to APPROVED, which moves both
    // counters on the home page stats strip — drop the cached copy.
    publicCache.invalidate('stats');

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
    // Member counters on the home page stats strip are cached.
    publicCache.invalidate('stats');
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

// The Executive Committee roster holds ONLY members holding an executive
// designation. General approved members are excluded.
//
// This query used to carry
//   $or: [{ role: MEMBER }, { designation: { $nin: ['', null] } }]
// which reads like "members or officers". It is not: `role` defaults to 'MEMBER'
// in the schema (services/roleService.js only promotes it to ADMIN for
// office-holders), so the first branch matches every ordinary approved member on
// its own and the designation clause never comes into it. The board therefore
// listed the whole membership.
//
// Filtering on designation alone is the fix, restricted to the known roles so a
// stray hand-edited value cannot put an unknown job title on the committee. This
// is the same shape services/clubContactService.js uses to find office-holders.
exports.listExecutiveCommittee = async (req, res) => {
  try {
    const users = await User.find({
      status: config.STATUS.APPROVED,
      designation: { $in: config.DESIGNATION_ROLES },
    }).sort({ designation: 1, membershipId: 1 });
    for (const u of users) await ensureMembershipId(u);
    const members = users.filter((u) => u.membershipId).map(execMemberView);
    return res.json({
      members,
      summary: { total: members.length, designated: members.length },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Autocomplete for the Member ID search box. Includes status + photo so the
// picker can surface a member's current approval state at a glance.
//
// Deliberately NOT narrowed to designated members, unlike the roster above: this
// is the picker used to GIVE someone a designation, so it has to reach the whole
// approved membership. Do not "fix" the $or here to match the roster filter.
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

    // Apply the role change immediately rather than waiting for the member's
    // next login / profile fetch, so the roster and dashboard stay in step. A
    // full pass is required because the authorized Executive Committee Member is
    // positional: this change may promote or demote a different account.
    await resyncDesignationRoles();

    // The role re-sync can promote to ADMIN, and the member roll counts real
    // people regardless of role, so the home page total is unaffected here — but
    // the roster summary it shares a cache entry with is not. Drop it anyway:
    // an admin action that changes who is who should never leave a stale count.
    publicCache.invalidate('stats');

    const updated = (await User.findById(user._id)) || user;

    return res.json({
      message: next ? `${user.fullName} is now ${next}` : `${user.fullName} is now a General Member`,
      member: execMemberView(updated),
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
    // An explicit assignment is the admin's decision: mark it manual so a later
    // designation change will not auto-revoke it.
    user.roleSource = 'manual';
    await user.save();
    publicCache.invalidate('stats');
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

// Resolve a stored /uploads/pdfs/... URL (or a bare "pdfs/x.pdf" path) back to
// the file inside STORAGE_DIR. Anything that escapes the storage root, or is not
// a PDF, is rejected so a crafted URL cannot delete a file outside it.
function storedPdfAbs(url) {
  const p = String(url || '').replace(/\\/g, '/');
  const marker = p.lastIndexOf('/pdfs/');
  const rel = marker >= 0 ? p.slice(marker + 1) : p.replace(/^\/uploads\//, '');
  if (!rel || !rel.toLowerCase().endsWith('.pdf')) return null;
  const root = path.resolve(config.STORAGE_DIR);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

// The generated application / ID-card PDFs are snapshots of the member's photo,
// name, address and membership number, written once to a fixed path and only
// rebuilt by serveFile when the file is missing. Editing a member (uploading a
// new photo, correcting the name, moving the ID) therefore left the cached PDFs
// showing the old — or a photo-less — document, which is exactly the report of
// photos and numbers missing from a downloaded PDF. Rebuild the documents that
// already exist from the record that was just saved, and drop the file left
// behind by a renamed membership ID so it cannot be served again.
async function refreshGeneratedDocuments(user) {
  if (user.status !== config.STATUS.APPROVED) return;

  const jobs = [
    {
      field: 'applicationPdfUrl',
      generate: () =>
        generateApplicationPdf(user, { approvedBy: user.approvedBy, approvedAt: user.approvedAt }),
    },
    { field: 'idCardPdfUrl', generate: () => generateIdCardPdf(user) },
  ];

  let changed = false;
  for (const job of jobs) {
    const oldUrl = user[job.field];
    if (!oldUrl) continue; // no document yet: serveFile builds it on first download
    try {
      const file = await job.generate();
      const stale = storedPdfAbs(oldUrl);
      if (stale && path.resolve(stale) !== path.resolve(file) && fs.existsSync(stale)) {
        try {
          fs.unlinkSync(stale);
          // Its stamp belongs to the deleted file; a leftover would otherwise
          // shadow the one written for the rebuilt document.
          if (fs.existsSync(`${stale}.stamp`)) fs.unlinkSync(`${stale}.stamp`);
        } catch (e) {
          console.warn(`[admin] could not remove stale document ${path.basename(stale)}: ${e.message}`);
        }
      }
      const next = publicUrl(path.relative(config.STORAGE_DIR, file));
      if (oldUrl !== next) {
        user[job.field] = next;
        changed = true;
      }
    } catch (e) {
      // Keep the old URL: serveFile regenerates the document when its file is
      // gone, so one failed rebuild must not break the edit response.
      console.error(`[admin] could not refresh ${job.field} for ${user._id}: ${e.message}`);
    }
  }
  if (changed) await user.save();
}

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

    // An edit can change the member's name, which is what tells a real member
    // apart from an authority-login placeholder, so it can change the count.
    publicCache.invalidate('stats');

    // Rebuild the member's PDFs so the downloaded documents carry the photo and
    // membership number that were just saved instead of the previous ones.
    await refreshGeneratedDocuments(user);

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
    publicCache.invalidate('stats');
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

    publicCache.invalidate();

    return res.json({
      message: 'All demo members cleared',
      deleted: result.deletedCount,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};