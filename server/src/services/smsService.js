const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/constants');

function generateOtp(digits = config.OTP_DIGITS) {
  const size = digits === 4 ? 4 : 6;
  const min = size === 4 ? 1000 : 100000;
  const max = size === 4 ? 9999 : 999999;
  return String(crypto.randomInt(min, max + 1)).padStart(size, '0');
}

// Strip country code prefixes (+91 / 91 / 0) and any punctuation so Fast2SMS
// receives a clean 10-digit Indian mobile number. Idempotent for clean numbers.
function sanitizePhone(v) {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

// Fast2SMS bills every 160-character page as a separate SMS, so a message that
// spills past one page is charged twice per OTP.
const SMS_PAGE_LENGTH = 160;

function countSmsPages(text) {
  return Math.max(1, Math.ceil(String(text || '').length / SMS_PAGE_LENGTH));
}

// Fast2SMS routes, per the official API reference:
//   q  -> Quick SMS (bulkV2). Standard pay-per-SMS rate, no DLT needed.
//   dlt-> Registered DLT template (needs FAST2SMS_SENDER_ID + TEMPLATE_ID).
// 'v3' appears in pre-2021 tutorials but is not a current Fast2SMS route, and the
// OTP API is a separate set of endpoints that requires a registered DLT template —
// so neither is a cheaper substitute for 'q'.
const SUPPORTED_ROUTES = ['q', 'dlt'];

function buildOtpMessage(clubName, otp, minutes) {
  // Must stay under SMS_PAGE_LENGTH or every OTP bills as 2 SMS.
  const text = `Dear Member, your ${clubName} verification code is ${otp}. Valid for ${minutes} min. Do not share it. - Aiswarya Library`;
  const pages = countSmsPages(text);
  if (pages > 1) {
    console.warn(
      `[SMS] OTP message is ${text.length} chars and will be billed as ${pages} SMS pages. ` +
        `Trim the copy to stay under ${SMS_PAGE_LENGTH} chars to avoid paying ${pages}x per OTP.`
    );
  }
  return text;
}

async function sendOtpViaFast2Sms(phone, otp) {
  const endpoint = config.FAST2SMS.apiUrl || 'https://www.fast2sms.com/dev/bulkV2';
  const configuredRoute = config.FAST2SMS.route || 'q';
  let route = configuredRoute;
  if (!SUPPORTED_ROUTES.includes(route)) {
    console.warn(
      `[FAST2SMS-WARN] Unsupported FAST2SMS_ROUTE "${route}" — falling back to "q" (Quick SMS). ` +
        `Supported routes: ${SUPPORTED_ROUTES.join(', ')}.`
    );
    route = 'q';
  }
  // Fast2SMS requires a clean 10-digit number; sanitize country-code prefixes.
  const numbers = sanitizePhone(phone);
  if (numbers.length !== 10) {
    console.warn(
      `[FAST2SMS-WARN] Non-10-digit input "${phone}" canonicalised to "${numbers}" – SMS may be rejected.`
    );
  }
  const clubName = `${config.CLUB.name}, ${config.CLUB.place}`;
  const message = buildOtpMessage(clubName, otp, config.OTP_EXPIRY_MINUTES);

  const payload = {
    route,
    message,
    language: 'english',
    flash: 0,
    numbers,
    // Returns character_count / per_sms_rate / amount_debited so the real cost of
    // each OTP is visible in the server log instead of having to be inferred.
    sms_details: '1',
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
        `[FAST2SMS-REQUEST-FAILED] ${status} for ${numbers}: ${err.response.data.message || err.response.data.error || errText}`
      );
      console.error(`[FAST2SMS-RESPONSE] ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`[FAST2SMS-REQUEST-FAILED] ${status} for ${numbers}: ${errText}`);
    }
    throw new Error(`Fast2SMS request failed (${status}): ${errText}`);
  }

  const data = resp.data;
  // Always log the raw Fast2SMS payload so DLT / template / credit / quota
  // errors are visible even when the HTTP call itself succeeds.
  console.log(`[FAST2SMS-RAW] ${route} → ${numbers} HTTP ${resp.status}: ${JSON.stringify(data)}`);
  if (!data || data.return === false) {
    const msg =
      (data && (data.message || data.error)) || 'unexpected response from Fast2SMS';
    // Fast2SMS answers HTTP 200 even for business-level failures, so always log
    // the returned payload to help diagnose quota/template/route problems.
    console.error(`[FAST2SMS-API-FAILED] ${msg} for ${numbers}`);
    if (data) console.error(`[FAST2SMS-RESPONSE] ${JSON.stringify(data)}`);
    throw new Error(`Fast2SMS API error: ${msg}`);
  }

  console.log(`[FAST2SMS-OK] ${route} route sent to ${numbers}: ${data.message || 'delivered'}`);
  if (data.sms_details) {
    console.log(`[FAST2SMS-COST] ${numbers}: ${JSON.stringify(data.sms_details)}`);
  }
  return data;
}

async function sendOtpMessage(toPhone, otp) {
  // Outside production there is no paid gateway, so the real, freshly
  // generated code is written to the server console instead of being texted.
  // This is a delivery substitute, not an auth bypass: the code still has to
  // match the bcrypt hash in the Otp collection to be accepted.
  if (config.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[DEV-MODE] OTP for ${toPhone}: ${otp}`);
    return { devOtp: config.DEV_ECHO_OTP ? otp : null };
  }

  if (!config.FAST2SMS.apiKey) {
    // eslint-disable-next-line no-console
    console.error(
      `[SMS] FAST2SMS_API_KEY is not configured — cannot deliver OTP to ${toPhone}. ` +
        'Set FAST2SMS_API_KEY in the environment.'
    );
    throw new Error('SMS gateway is not configured');
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
  sanitizePhone,
  countSmsPages,
  buildOtpMessage,
  sendOtpViaFast2Sms,
  sendOtpMessage,
};