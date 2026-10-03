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

// Fast2SMS debits one "SMS" per page, and the page size depends on the encoding
// it infers for the text. Anything outside the GSM 03.38 basic alphabet is
// classified as Unicode, where a page holds only 70 characters instead of 160.
// These are Fast2SMS' own documented debit boundaries:
//   English (GSM-7): 1 SMS up to 160 chars, 2 up to 306, 3 up to 459, ...
//   Unicode:         1 SMS up to  70 chars, 2 up to 133, 3 up to 199, ...
const GSM7_PAGE_LIMITS = [160, 306, 459, 612, 765];
const UNICODE_PAGE_LIMITS = [70, 133, 199, 265, 331];

// Printable ASCII plus the accented/Greek extras that still fit in GSM 03.38.
// A character missing from this set (₹, curly quotes, en dash, emoji, ...) makes
// the whole SMS Unicode, which both shrinks the page to 70 chars and is billed at
// a higher per-SMS rate on most Indian gateways.
const GSM7_BASIC = new RegExp(
  '^[\\x20-\\x7E\\n\\r\\t@\\u00A3\\u00A5\\u00E8\\u00E9\\u00F9\\u00EC\\u00F2' +
    '\\u00C7\\u00D8\\u00F8\\u00C5\\u00E5]*$'
);

function isGsm7(text) {
  return GSM7_BASIC.test(String(text || ''));
}

function countSmsPages(text) {
  const len = String(text || '').length;
  const limits = isGsm7(text) ? GSM7_PAGE_LIMITS : UNICODE_PAGE_LIMITS;
  const index = limits.findIndex((max) => len <= max);
  if (index !== -1) return index + 1;
  const perPage = limits[1] - limits[0];
  return limits.length + Math.ceil((len - limits[limits.length - 1]) / perPage);
}

// Fast2SMS routes, per the official API reference:
//   q  -> Quick SMS (bulkV2). Standard pay-per-SMS rate, no DLT needed.
//   dlt-> Registered DLT template (needs FAST2SMS_SENDER_ID + TEMPLATE_ID).
// 'v3' appears in pre-2021 tutorials but is not a current Fast2SMS route, and the
// OTP API is a separate set of endpoints that requires a registered DLT template —
// so neither is a cheaper substitute for 'q'.
const SUPPORTED_ROUTES = ['q', 'dlt'];

// Anything above this per-SMS rate means the send is being classified or billed
// outside the standard tier and should be investigated.
const EXPECTED_MAX_PER_SMS_RATE = 1;

function buildOtpMessage(clubName, otp, minutes) {
  const text =
    `Dear Member, your ${clubName} OTP is ${otp}. ` +
    `Valid for ${minutes} min. Do not share it.`;

  const gsm7 = isGsm7(text);
  const pages = countSmsPages(text);
  if (!gsm7) {
    const offenders = [...new Set(text.split(''))].filter((ch) => !GSM7_BASIC.test(ch));
    console.warn(
      `[SMS] OTP message contains non-GSM-7 characters (${JSON.stringify(offenders.join(''))}), ` +
        'so Fast2SMS will treat it as Unicode (70 chars per page). Replace them with ASCII.'
    );
  }
  if (pages > 1) {
    console.warn(
      `[SMS] OTP message is ${text.length} chars and bills as ${pages} SMS pages ` +
        `(${gsm7 ? 'English' : 'Unicode'}). Trim it to stay inside a single page.`
    );
  }
  return text;
}

// Fast2SMS has changed the shape of the sms_details block before, so read the
// cost fields defensively and report whatever came back rather than assuming a
// fixed structure.
function summarizeDebit(data) {
  if (!data || typeof data !== 'object') return null;
  const parts = data.sms_details || data.details || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (parts[k] !== undefined && parts[k] !== null) return parts[k];
    }
    return undefined;
  };
  const summary = {
    request_id: data.request_id,
    character_count: pick('character_count', 'characterCount'),
    sms_count: pick('sms_count', 'smsCount'),
    sms_language: pick('sms_language', 'smsLanguage'),
    per_sms_rate: pick('per_sms_rate', 'perSmsRate'),
    amount_debited: pick('amount_debited', 'amountDebited'),
  };
  return Object.values(summary).some((v) => v !== undefined) ? summary : null;
}

// Shared request plumbing for both Fast2SMS transports.
async function postToFast2Sms(endpoint, payload, numbers, label) {
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
        `[FAST2SMS-REQUEST-FAILED] ${label} ${status} for ${numbers}: ${err.response.data.message || err.response.data.error || errText}`
      );
      console.error(`[FAST2SMS-RESPONSE] ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`[FAST2SMS-REQUEST-FAILED] ${label} ${status} for ${numbers}: ${errText}`);
    }
    throw new Error(`Fast2SMS request failed (${label} ${status}): ${errText}`);
  }

  const data = resp.data;
  // Always log the raw Fast2SMS payload so DLT / template / credit / quota
  // errors are visible even when the HTTP call itself succeeds.
  console.log(`[FAST2SMS-RAW] ${label} → ${numbers} HTTP ${resp.status}: ${JSON.stringify(data)}`);
  if (!data || data.return === false) {
    const msg =
      (data && (data.message || data.error)) || 'unexpected response from Fast2SMS';
    // Fast2SMS answers HTTP 200 even for business-level failures, so always log
    // the returned payload to help diagnose quota/template/route problems.
    console.error(`[FAST2SMS-API-FAILED] ${label}: ${msg} for ${numbers}`);
    if (data) console.error(`[FAST2SMS-RESPONSE] ${JSON.stringify(data)}`);
    throw new Error(`Fast2SMS API error: ${msg}`);
  }
  return data;
}

// Config problems are static for the process lifetime, so warn once each rather
// than on every OTP send.
const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

// Report exactly what was debited so an unexpected rate is visible in the log
// rather than only showing up later on the Fast2SMS invoice. Both bulkV2 routes
// answer with sms_details when it is requested.
function logDebit(numbers, data, context) {
  const debit = summarizeDebit(data);
  if (!debit) {
    console.log(
      `[FAST2SMS-COST] ${numbers}: no sms_details returned for request_id ${data.request_id || 'n/a'}`
    );
    return;
  }

  console.log(`[FAST2SMS-COST] ${numbers}: ${JSON.stringify(debit)}`);
  const rate = Number(debit.per_sms_rate);
  if (Number.isFinite(rate) && rate > EXPECTED_MAX_PER_SMS_RATE) {
    const { message, senderId, templateId } = context || {};
    const via = senderId
      ? `sender ${senderId} / template ${templateId}`
      : `message of ${debit.character_count ?? (message ? message.length : '?')} chars`;
    console.warn(
      `[FAST2SMS-HIGH-COST] per_sms_rate ${rate} exceeds the expected ≤${EXPECTED_MAX_PER_SMS_RATE} ` +
        `for ${numbers} (${via}, ${debit.sms_language || 'language unknown'}). ` +
        'Check the Fast2SMS plan rate card and whether the sender ID is DLT-registered.'
    );
  }
}

// Official OTP API: POST /dev/otp/send. Bills on the OTP rate card rather than
// the quick-SMS tier, and the message text comes from the registered OTP
// template, so it cannot drift over the per-page billing limits.
//
// `otp_id` is REQUIRED and must be an OTP template registered on the Fast2SMS
// account (dashboard → Dev API → OTP Templates); without one Fast2SMS rejects
// the send with 400 "Invalid OTP ID". This app supplies its own `otp` value, so
// the code that arrives is the same one hashed into our Otp collection and
// verification stays entirely server-side.
async function sendViaOtpApi(numbers, otp) {
  const endpoint =
    config.FAST2SMS.otpApiUrl || 'https://www.fast2sms.com/dev/otp/send';
  const otpId = String(config.FAST2SMS.otpId || '').trim();

  const payload = {
    mobile: numbers,
    otp_id: otpId,
    otp,
    otp_length: config.OTP_DIGITS,
    otp_expiry: config.OTP_EXPIRY_MINUTES,
  };
  // Only needed when the registered template declares {#var#} placeholders.
  // Passed verbatim so the values can mirror the exact registered template.
  const variables = String(config.FAST2SMS.otpVariables || '').trim();
  if (variables) payload.variables_values = variables;

  const data = await postToFast2Sms(endpoint, payload, numbers, 'otp-api');
  console.log(`[FAST2SMS-OK] otp-api sent to ${numbers}: ${data.message || 'delivered'}`);
  // The Send OTP response carries no cost block — amount_debited /
  // per_sms_rate only arrive on the Fast2SMS delivery webhook, so there is
  // nothing to reconcile here beyond the request id.
  console.log(
    `[FAST2SMS-COST] ${numbers}: not returned by Send OTP; see webhook amount_debited ` +
      `for request_id ${data.request_id || 'n/a'}`
  );
  return data;
}

// DLT route on the same /dev/bulkV2 endpoint. Bills on the DLT/transactional
// rate card, which is the compliant standard per-SMS rate.
//
// The DLT body is NOT the quick-SMS body with extra fields added:
//   - `message` is the DLT **template id** (e.g. "111111"), not free text. The
//     wording lives in the approved template.
//   - `variables_values` carries the values for that template's {#var#}
//     placeholders, pipe-separated.
//   - There is no `template_id` field in the schema.
// Requires a sender id and template registered in the Fast2SMS DLT Manager
// first; Fast2SMS rejects unregistered headers outright.
async function sendViaDlt(numbers, otp) {
  const endpoint = config.FAST2SMS.apiUrl || 'https://www.fast2sms.com/dev/bulkV2';
  const senderId = String(config.FAST2SMS.senderId || '').trim();
  const templateId = String(config.FAST2SMS.templateId || '').trim();

  // Fast2SMS documents the sender id as 3-6 letters; anything longer is
  // rejected, so catch it here rather than as an opaque API error.
  if (!/^[A-Za-z]{3,6}$/.test(senderId)) {
    throw new Error(
      `FAST2SMS_SENDER_ID must be a 3-6 letter DLT-approved sender id (got "${senderId}")`
    );
  }

  // Values for the template's {#var#} placeholders. FAST2SMS_DLT_VARIABLES lets a
  // multi-variable template be filled in template order; {otp} expands to the
  // code we generated. With nothing configured the template's only variable is
  // assumed to be the OTP.
  const template = String(config.FAST2SMS.dltVariables || '').trim();
  const variables = template ? template.split('{otp}').join(otp) : otp;

  // `message` is typed as an integer in the schema, so send the numeric id.
  const payload = {
    route: 'dlt',
    sender_id: senderId,
    message: /^\d+$/.test(templateId) ? Number(templateId) : templateId,
    variables_values: variables,
    numbers,
    sms_details: '1',
  };

  const data = await postToFast2Sms(endpoint, payload, numbers, 'dlt');

  console.log(
    `[FAST2SMS-OK] dlt route sent to ${numbers} via sender ${senderId} / template ${templateId}: ` +
      `${data.message || 'delivered'}`
  );

  logDebit(numbers, data, { senderId, templateId });
  return data;
}

async function sendViaQuickSms(numbers, otp) {
  const endpoint = config.FAST2SMS.apiUrl || 'https://www.fast2sms.com/dev/bulkV2';
  const clubName = `${config.CLUB.name}, ${config.CLUB.place}`;
  const message = buildOtpMessage(clubName, otp, config.OTP_EXPIRY_MINUTES);

  // Only the fields the Fast2SMS POST /dev/bulkV2 quick-SMS schema documents are
  // sent: route, message, numbers, sms_details. The legacy "language" and
  // "flash" params are deliberately omitted — they are undocumented for this
  // endpoint, and Fast2SMS infers English vs Unicode from the content, so passing
  // them only risks mis-setting the encoding (Unicode shrinks the page to 70
  // chars and bills higher).
  const payload = {
    route: 'q',
    message,
    numbers,
    // Returns character_count / per_sms_rate / amount_debited so the real cost of
    // each OTP is visible in the server log instead of having to be inferred.
    sms_details: '1',
  };

  const data = await postToFast2Sms(endpoint, payload, numbers, 'q');

  console.log(`[FAST2SMS-OK] q route sent to ${numbers}: ${data.message || 'delivered'}`);
  logDebit(numbers, data, { message });
  return data;
}

async function sendOtpViaFast2Sms(phone, otp) {
  // Fast2SMS requires a clean 10-digit number; sanitize country-code prefixes.
  const numbers = sanitizePhone(phone);
  if (numbers.length !== 10) {
    console.warn(
      `[FAST2SMS-WARN] Non-10-digit input "${phone}" canonicalised to "${numbers}" – SMS may be rejected.`
    );
  }

  // Transport preference: the DLT route when it is fully configured (it bills
  // on the standard DLT rate card), then the OTP API, then quick SMS. The two
  // preferred routes both need a template registered on the Fast2SMS account, so
  // each falls through rather than failing the send when it is not set up.
  if (config.FAST2SMS.route === 'dlt') {
    const senderId = String(config.FAST2SMS.senderId || '').trim();
    const templateId = String(config.FAST2SMS.templateId || '').trim();
    if (senderId && templateId) return sendViaDlt(numbers, otp);
    warnOnce(
      'dlt',
      '[FAST2SMS-WARN] FAST2SMS_ROUTE=dlt needs both FAST2SMS_SENDER_ID and ' +
        'FAST2SMS_TEMPLATE_ID, and the header must be registered in the Fast2SMS ' +
        `DLT Manager (dashboard -> DLT Manager). Missing: ` +
        `${[!senderId && 'FAST2SMS_SENDER_ID', !templateId && 'FAST2SMS_TEMPLATE_ID'] .filter(Boolean).join(', ') || 'none'}. ` +
        'Falling back until they are set.'
    );
  } else if (!SUPPORTED_ROUTES.includes(config.FAST2SMS.route)) {
    warnOnce(
      'route',
      `[FAST2SMS-WARN] Unsupported FAST2SMS_ROUTE "${config.FAST2SMS.route}" ` +
        `(supported: ${SUPPORTED_ROUTES.join(', ')}). Using the quick-SMS route.`
    );
  }

  if (config.FAST2SMS.otpId) return sendViaOtpApi(numbers, otp);
  warnOnce(
    'otp',
    '[FAST2SMS-WARN] FAST2SMS_OTP_ID is not set, so the OTP API cannot be used ' +
      '(it requires a registered OTP template id) and the OTP is going through the ' +
      'quick-SMS route instead. Register an OTP template at ' +
      'https://www.fast2sms.com/dashboard/dev-api and set FAST2SMS_OTP_ID to switch.'
  );
  return sendViaQuickSms(numbers, otp);
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
  isGsm7,
  countSmsPages,
  summarizeDebit,
  buildOtpMessage,
  sendViaOtpApi,
  sendViaDlt,
  sendViaQuickSms,
  sendOtpViaFast2Sms,
  sendOtpMessage,
};