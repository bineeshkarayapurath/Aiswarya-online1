const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/constants');

function generateOtp(digits = config.OTP_DIGITS) {
  const size = digits === 4 ? 4 : 6;
  const min = size === 4 ? 1000 : 100000;
  const max = size === 4 ? 9999 : 999999;
  return String(crypto.randomInt(min, max + 1)).padStart(size, '0');
}

function buildOtpMessage(clubName, otp, minutes) {
  return `Dear Member, your ${clubName} verification code is ${otp}. It is valid for ${minutes} minutes. Please do not share this code with anyone. - Aiswarya Library`;
}

async function sendOtpViaFast2Sms(phone, otp) {
  const endpoint = config.FAST2SMS.apiUrl || 'https://www.fast2sms.com/dev/bulkV2';
  const route = config.FAST2SMS.route || 'q';
  const clubName = `${config.CLUB.name}, ${config.CLUB.place}`;
  const message = buildOtpMessage(clubName, otp, config.OTP_EXPIRY_MINUTES);

  const payload = {
    route,
    message,
    language: 'english',
    flash: 0,
    numbers: String(phone).replace(/\D/g, ''),
  };
  if (route === 'dlt') {
    payload.sender_id = config.FAST2SMS.senderId || 'AISWRY';
    payload.variables_values = otp;
    if (config.FAST2SMS.templateId) payload.template_id = config.FAST2SMS.templateId;
  }

  const resp = await axios.post(endpoint, payload, {
    headers: {
      authorization: config.FAST2SMS.apiKey,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    timeout: 15000,
  });

  const data = resp.data;
  if (!data || data.return === false) {
    throw new Error(`Fast2SMS error: ${(data && data.message) || 'unexpected response'}`);
  }
  return data;
}

async function sendOtpMessage(toPhone, otp) {
  // DEV MODE fallback: never call the paid gateway outside production. The code
  // is logged to the server/Render console so flows can still be tested.
  if (config.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[DEV-MODE] OTP for ${toPhone}: ${otp}`);
    return { devOtp: otp };
  }

  if (!config.FAST2SMS.apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[DEV-MODE] FAST2SMS_API_KEY missing – OTP for ${toPhone}: ${otp}`);
    return { devOtp: otp };
  }

  try {
    await sendOtpViaFast2Sms(toPhone, otp);
    return { devOtp: null };
  } catch (err) {
    // Graceful fallback: keep the flow usable by logging the code so it can be
    // recovered from Render logs when Fast2SMS is down or misconfigured.
    console.error(`[FAST2SMS-FAILED] ${err && err.message ? err.message : err}. Logged OTP for ${toPhone}: ${otp}`);
    return { devOtp: null };
  }
}

module.exports = {
  generateOtp,
  buildOtpMessage,
  sendOtpViaFast2Sms,
  sendOtpMessage,
};