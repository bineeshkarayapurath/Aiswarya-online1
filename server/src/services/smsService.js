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

  let resp;
  try {
    resp = await axios.post(endpoint, payload, {
      headers: {
        authorization: config.FAST2SMS.apiKey,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
    });
  } catch (err) {
    // axios throws for network errors and non-2xx HTTP statuses. Log the full
    // response body (Fast2SMS sends useful "message" fields there).
    const status = err.response ? `HTTP ${err.response.status}` : 'NETWORK';
    const errText =
      err.code || err.message || 'no error details supplied by the request layer';
    if (err.response && err.response.data) {
      console.error(
        `[FAST2SMS-REQUEST-FAILED] ${status} for ${phone}: ${err.response.data.message || err.response.data.error || errText}`
      );
      console.error(`[FAST2SMS-RESPONSE] ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`[FAST2SMS-REQUEST-FAILED] ${status} for ${phone}: ${errText}`);
    }
    throw new Error(`Fast2SMS request failed (${status}): ${errText}`);
  }

  const data = resp.data;
  if (!data || data.return === false) {
    const msg =
      (data && (data.message || data.error)) || 'unexpected response from Fast2SMS';
    // Fast2SMS answers HTTP 200 even for business-level failures, so always log
    // the returned payload to help diagnose quota/template/route problems.
    console.error(`[FAST2SMS-API-FAILED] ${msg} for ${phone}`);
    if (data) console.error(`[FAST2SMS-RESPONSE] ${JSON.stringify(data)}`);
    throw new Error(`Fast2SMS API error: ${msg}`);
  }

  console.log(`[FAST2SMS-OK] ${route} route sent to ${phone}: ${data.message || 'delivered'}`);
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
    // recovered from Render logs when Fast2SMS is down or misconfigured. Never
    // return the OTP to the client in production.
    console.error(
      `[FAST2SMS-FAILED] ${err && err.message ? err.message : err}. Logged OTP for ${toPhone}: ${otp}`
    );
    if (err && err.stack) console.error(`[FAST2SMS-FAILED-STACK] ${err.stack}`);
    return { devOtp: null };
  }
}

module.exports = {
  generateOtp,
  buildOtpMessage,
  sendOtpViaFast2Sms,
  sendOtpMessage,
};