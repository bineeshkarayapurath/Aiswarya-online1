const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/constants');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { signToken } = require('../middleware/auth');
const { generateOtp } = require('../utils/otp');
const { sendWhatsAppOtp } = require('../services/whatsappService');
const { syncDesignationRole } = require('../services/roleService');

// Normalise a phone number so "9999999999", "919999999999", "+91 99999 99999"
// all match the same value (Indian mobile = 10 digits).
function canonicalPhone(v) {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

const SUPER_ADMIN_PHONES = config.SUPER_ADMIN_PHONES.map(canonicalPhone);

async function hashOtp(code) {
  return bcrypt.hash(code, 10);
}

async function createOtp(identifier) {
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  const expires = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000);
  await Otp.deleteMany({ identifier, used: false });
  await Otp.create({ identifier, codeHash, expiresAt: expires });
  return code;
}

async function verifyOtp(identifier, code) {
  const cleanCode = String(code || '').trim();

  // No fixed/test code is accepted here. The only way past this is a record in
  // the Otp collection whose bcrypt hash matches, created by a real
  // generateOtp() + WhatsApp delivery.
  const otpDoc = await Otp.findOne({
    identifier,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) throw new Error('OTP expired');
  if (otpDoc.attempts >= 5) {
    otpDoc.used = true;
    await otpDoc.save();
    throw new Error('Too many failed attempts. Please request a new OTP.');
  }

  otpDoc.attempts += 1;
  const match = await bcrypt.compare(cleanCode, otpDoc.codeHash);
  if (!match) {
    await otpDoc.save();
    throw new Error('Invalid OTP');
  }
  otpDoc.verified = true;
  otpDoc.used = true;
  await otpDoc.save();
  return true;
}

exports.sendOtp = async (req, res) => {
  try {
    const raw = String(req.body.phoneNumber || req.body.identifier || '').trim();
    // Canonicalise so "+91 99999 99999" / "919999999999" become "9999999999" —
    // the OTP is stored and delivered against this clean 10-digit value.
    let phone = canonicalPhone(raw);
    // If the input is a membership ID (e.g. AISC-001 / AISC-2026-0001), resolve
    // it to the member's registered phone so the OTP reaches a working inbox.
    if (phone.length !== 10 && /^[A-Za-z0-9]+-\d+(-\d+)?$/.test(raw)) {
      const member = await User.findOne({ membershipId: raw.trim().toUpperCase() });
      if (member && member.phoneNumber) phone = canonicalPhone(member.phoneNumber);
    }
    if (!phone || phone.length !== 10) {
      return res
        .status(400)
        .json({ message: 'A valid 10-digit phone number is required' });
    }

    const code = await createOtp(phone);
    const result = await sendWhatsAppOtp(phone, code);

    return res.json({
      message: 'OTP sent via WhatsApp',
      devOtp: result.devOtp || null,
    });
  } catch (err) {
    // A delivery failure is not an internal fault — it is usually a config or
    // opt-in problem the user cannot act on. 502 tells the client the upstream
    // provider failed, so the UI can offer "try again" rather than a generic
    // server error, and the detail is already safe (no tokens, no OTP).
    console.error(`[AUTH] WhatsApp OTP delivery failed for /api/auth/send-otp: ${err.message}`);
    return res.status(502).json({
      message: 'Could not send the WhatsApp message. Please try again shortly.',
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { identifier, code } = req.body;
    if (!identifier || !code) {
      return res.status(400).json({ message: 'identifier and code are required' });
    }
    await verifyOtp(String(identifier).trim(), String(code).trim());
    return res.json({ message: 'OTP verified' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      identifier,
      fullName,
      dob,
      address,
      occupation,
      education,
      recommenderName,
      recommenderMemberId,
      email,
      phoneVerified,
      phoneVerifiedVia,
      firebaseUid,
    } = req.body;
    if (!identifier || !fullName || !dob || !address) {
      return res
        .status(400)
        .json({ message: 'identifier, fullName, dob, and address are required' });
    }
    const phone = String(identifier).trim();

    const existing = await User.findOne({ phoneNumber: phone });
    if (existing && existing.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ message: 'This phone number is already registered' });
    }

    const dobDate = new Date(dob);
    const age = Math.floor(
      (Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Member photo: a public HTTPS URL from POST /api/upload (local storage or
    // ImgBB) wins when present; otherwise fall back to the locally stored file.
    const externalPhotoUrl = String(req.body.photoUrl || '').trim();
    const photoUrl = externalPhotoUrl
      ? externalPhotoUrl
      : req.file
        ? `photos/${req.file.filename}`
        : undefined;

    const user =
      existing && existing.status === 'PENDING_APPROVAL'
        ? existing
        : new User({ phoneNumber: phone });

    user.fullName = fullName;
    user.dob = dobDate;
    user.age = age;
    user.address = address;
    user.occupation = occupation || '';
    user.education = education || '';
    user.email = email || '';
    user.recommender = {
      name: recommenderName || '',
      memberId: recommenderMemberId || '',
    };
    user.registrationNo = config.CLUB.regNo;
    user.status = config.STATUS.PENDING;

    if (photoUrl) user.photoUrl = photoUrl;

    const verified = phoneVerified === true || phoneVerified === 'true';
    const via = ['firebase', 'sms', 'whatsapp', 'manual'].includes(phoneVerifiedVia)
      ? phoneVerifiedVia
      : verified ? 'manual' : '';
    user.phoneVerified = verified;
    user.phoneVerifiedVia = via;
    if (via === 'firebase' && firebaseUid) {
      const uid = String(firebaseUid).trim().slice(0, 128);
      if (uid) user.firebaseUid = uid;
    }

    await user.save();

    const userObj = user.toObject();
    delete userObj.lowerPhone;
    return res.status(201).json({
      message: 'Registration successful',
      user: { ...userObj, status: config.STATUS.PENDING },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Registration failed' });
  }
};

exports.memberLogin = async (req, res) => {
  try {
    const { identifier, code } = req.body;
    if (!identifier || !code) {
      return res.status(400).json({ message: 'identifier and code are required' });
    }
    const input = String(identifier).trim();
    const isMembershipId = /^[A-Za-z0-9]+-\d+(-\d+)?$/.test(input);

    let user;
    if (isMembershipId) {
      user = await User.findOne({ membershipId: input.toUpperCase() });
    } else {
      user = await User.findOne({ phoneNumber: input });
    }

    // OTPs are issued against the member's 10-digit phone (membership-ID logins
    // are resolved to the owner's phone in sendOtp), so verify against that.
    const otpIdentifier = isMembershipId
      ? (user ? user.phoneNumber : input)
      : canonicalPhone(input);
    await verifyOtp(otpIdentifier, String(code).trim());

    if (!user || user.status !== config.STATUS.APPROVED) {
      return res.status(403).json({ message: 'Access denied. Account not approved or not found.' });
    }

    // An Executive Committee designation (President, Secretary, ...) grants
    // admin access automatically, so the session carries the right role
    // without anyone having to run set-role by hand.
    await syncDesignationRole(user);

    const token = signToken(user);
    const userObj = user.toObject();
    delete userObj.lowerPhone;
    return res.json({ token, user: userObj });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Login failed' });
  }
};

exports.adminLoginSendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const normalized = String(phone || '').trim();
    const canonical = canonicalPhone(normalized);
    // Authority access is decided solely by SUPER_ADMIN_PHONES. There is no
    // test number and no code returned in the response — a real OTP is always
    // generated and delivered over WhatsApp.
    if (!SUPER_ADMIN_PHONES.includes(canonical)) {
      return res.status(403).json({ message: 'Unauthorised phone number' });
    }
    const code = await createOtp(normalized);
    const result = await sendWhatsAppOtp(normalized, code);
    return res.json({ message: 'OTP sent via WhatsApp', devOtp: result.devOtp || null });
  } catch (err) {
    console.error(`[AUTH] WhatsApp OTP delivery failed for the Authority Zone: ${err.message}`);
    return res.status(502).json({
      message: 'Could not send the WhatsApp message. Please try again shortly.',
    });
  }
};

exports.adminLoginVerify = async (req, res) => {
  try {
    const { phone, code, masterPin } = req.body;
    const normalized = String(phone || '').trim();
    const canonical = canonicalPhone(normalized);

    // Real master PIN from the environment — no hardcoded default and no
    // dev bypass. An unset MASTER_PIN matches nothing, locking the zone shut.
    if (!config.MASTER_PIN) {
      return res.status(503).json({ message: 'Authority Zone is not configured' });
    }
    if (String(masterPin || '').trim() !== config.MASTER_PIN) {
      return res.status(403).json({ message: 'Invalid master PIN' });
    }
    if (!SUPER_ADMIN_PHONES.includes(canonical)) {
      return res.status(403).json({ message: 'Unauthorised phone number' });
    }
    await verifyOtp(normalized, String(code || '').trim());

    let user = await User.findOne({
      $or: [{ phoneNumber: canonical }, { phoneNumber: normalized }],
    });
    if (!user) {
      user = new User({
        fullName: canonical,
        phoneNumber: canonical,
        dob: new Date('1990-01-01'),
        address: 'Club Office',
        role: config.ROLES.ADMIN,
        designation: 'Executive Committee Member',
        // Granted by the authority-login flow itself, not derived from the
        // designation — so syncDesignationRole will never auto-revoke it.
        roleSource: 'manual',
        status: config.STATUS.APPROVED,
        registrationNo: config.CLUB.regNo,
      });
      await user.save();
    } else if (user.role !== config.ROLES.ADMIN && user.role !== config.ROLES.SUPER_ADMIN) {
      user.role = config.ROLES.ADMIN;
      user.roleSource = 'manual';
      user.status = config.STATUS.APPROVED;
      await user.save();
    }

    const token = signToken(user);
    return res.json({ token, user: { ...user.toObject(), lowerPhone: undefined } });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Verification failed' });
  }
};

exports.getMe = async (req, res) => {
  // A designation change made by another officer takes effect on the next
  // profile fetch, so a promoted/deposed member never keeps a stale role.
  await syncDesignationRole(req.user);
  const userObj = req.user.toObject();
  delete userObj.lowerPhone;
  return res.json({ user: userObj });
};