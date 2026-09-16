const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/constants');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { signToken } = require('../middleware/auth');
const { generateOtp, sendOtpMessage } = require('../services/smsService');

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
  // DEV MODE bypass: the fixed test OTP skips real SMS delivery entirely.
  if (config.NODE_ENV !== 'production' && cleanCode === config.TEST_OTP) {
    return true;
  }

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
  const match = await bcrypt.compare(code, otpDoc.codeHash);
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
    const phone = canonicalPhone(raw);
    if (!phone || phone.length !== 10) {
      return res
        .status(400)
        .json({ message: 'A valid 10-digit phone number is required' });
    }

    const code = await createOtp(phone);
    const result = await sendOtpMessage(phone, code);

    return res.json({
      message: 'OTP sent',
      devOtp: result.devOtp || null,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to send OTP' });
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
    await verifyOtp(input, String(code).trim());

    let user;
    if (/^[A-Za-z0-9]+-[0-9]{4}-[0-9]+$/.test(input)) {
      user = await User.findOne({ membershipId: input });
    } else {
      user = await User.findOne({ phoneNumber: input });
    }

    if (!user || user.status !== config.STATUS.APPROVED) {
      return res.status(403).json({ message: 'Access denied. Account not approved or not found.' });
    }

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
    const isTestAdmin =
      config.NODE_ENV !== 'production' && canonical === canonicalPhone(config.TEST_PHONE);
    if (!SUPER_ADMIN_PHONES.includes(canonical) && !isTestAdmin) {
      return res.status(403).json({ message: 'Unauthorised phone number' });
    }
    if (isTestAdmin || config.NODE_ENV !== 'production') {
      return res.json({
        message: 'Test OTP ready (DEV MODE)',
        devOtp: config.TEST_OTP,
      });
    }
    const code = await createOtp(normalized);
    const result = await sendOtpMessage(normalized, code);
    return res.json({ message: 'OTP sent', devOtp: result.devOtp || null });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.adminLoginVerify = async (req, res) => {
  try {
    const { phone, code, masterPin } = req.body;
    const normalized = String(phone || '').trim();
    const canonical = canonicalPhone(normalized);
    const devBypass =
      config.NODE_ENV !== 'production' &&
      String(masterPin || '').trim() === '123456' &&
      String(code || '').trim() === config.TEST_OTP;

    if (!devBypass && masterPin !== config.MASTER_PIN) {
      return res.status(403).json({ message: 'Invalid master PIN' });
    }
    const isTestAdmin =
      config.NODE_ENV !== 'production' && canonical === canonicalPhone(config.TEST_PHONE);
    if (!devBypass && !SUPER_ADMIN_PHONES.includes(canonical) && !isTestAdmin) {
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
        status: config.STATUS.APPROVED,
        registrationNo: config.CLUB.regNo,
      });
      await user.save();
    } else if (user.role !== config.ROLES.ADMIN && user.role !== config.ROLES.SUPER_ADMIN) {
      user.role = config.ROLES.ADMIN;
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
  const userObj = req.user.toObject();
  delete userObj.lowerPhone;
  return res.json({ user: userObj });
};