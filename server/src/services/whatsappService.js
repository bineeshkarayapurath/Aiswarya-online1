const axios = require('axios');
const config = require('../config/constants');

// Meta Graph API for WhatsApp Cloud. The version is configurable because
// Graph pins a given version's behaviour for ~2 years; bump it deliberately.
const GRAPH_HOST = 'https://graph.facebook.com';

// Authentication-template errors that are worth translating into something
// actionable. Everything else falls through to Meta's own message, which is
// already specific enough (it echoes the offending template name/parameter).
const GRAPH_ERROR_HINTS = {
  100: 'Invalid request parameter — check WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE and that the template has the parameter placeholders you are sending.',
  190: 'The WhatsApp access token is missing, expired or malformed. Generate a fresh token and update WHATSAPP_ACCESS_TOKEN.',
  470: 'Message outside the 24-hour customer service window. Re-send as an approved template (which this already is) and confirm the template is still approved.',
  80007: 'WhatsApp rate limit hit. Retry after a short backoff.',
  131030: 'Recipient is not in the allowed list. In development mode the number must be added as a test recipient in the Meta dashboard, and the user must have opted in.',
  131047: 'Re-engagement message declined — more than 24 hours since the user last replied. Ask the user to send any message first.',
  131051: 'Message type is not supported for this template. Confirm the template category is AUTHENTICATION.',
  131052: 'The media or template referenced is not available for this WhatsApp Business Account.',
  131056: 'The recipient has opted out of WhatsApp messages from this business.',
  132000: 'Template parameter count mismatch — the number of parameters sent must exactly match the placeholders in the approved template.',
  132001: 'The template does not exist or has not been approved yet.',
  132005: 'The template has been paused.',
  132007: 'The template quality has been rated too low and is no longer allowed for this category.',
  133000: 'The template is too long for WhatsApp.',
};

// Meta wants the recipient as digits only, prefixed by the country code and
// with no "+", spaces or dashes: 919876543210. Accept the shapes a member is
// likely to type (9876543210 / 09876543210 / +91 98765 43210 / 919876543210)
// and normalise to E.164. Returns null when the input cannot be a real number.
function toWhatsAppRecipient(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;

  // National format with a trunk prefix -> strip the 0 and add the country code.
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  // Bare 10-digit Indian mobile -> add 91. Only do this when no country code
  // was supplied, so international numbers already carrying theirs survive.
  if (digits.length === 10) digits = `91${digits}`;

  // E.164 allows a minimum of 8 and a maximum of 15 digits. Indian mobile
  // numbers are 12 (91 + 10); anything shorter is not a complete number.
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith('0')) return null;
  return digits;
}

// Authentication templates have a fixed body of "{{1}} is your verification
// code." plus an optional security disclaimer and expiry line. Meta injects the
// wording; the only thing the business supplies is the code itself.
//
// If the approved template includes the one-tap autofill / "copy code" button,
// the OTP must ALSO be supplied as a button parameter — Meta rejects the
// request when the template declares a button that the payload omits. Templates
// without that button must not receive the extra component, which is why this
// is toggled by WHATSAPP_TEMPLATE_HAS_OTP_BUTTON.
function buildAuthTemplatePayload({ recipient, otp }) {
  const templateName = String(config.WHATSAPP.templateName || '').trim();
  if (!templateName) {
    throw new Error('WHATSAPP_TEMPLATE_NAME is required to send a WhatsApp OTP');
  }

  const components = [
    {
      type: 'body',
      parameters: [{ type: 'text', text: String(otp) }],
    },
  ];

  if (config.WHATSAPP.templateHasOtpButton) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(otp) }],
    });
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: config.WHATSAPP.templateLanguage },
      components,
    },
  };
}

// Graph answers failures as { error: { code, message, type, error_subcode,
// error_data, fbtrace_id } } with a 4xx status. Pull out the pieces that help
// and pair the code with a hint where we have one. The token is never part of
// this, so the result is safe to log.
function describeGraphError(data) {
  const err = (data && data.error) || {};
  const parts = [];
  if (err.code !== undefined && err.code !== null) parts.push(`code ${err.code}`);
  if (err.error_subcode !== undefined && err.error_subcode !== null) {
    parts.push(`subcode ${err.error_subcode}`);
  }
  const head = parts.length ? `[${parts.join(', ')}] ` : '';
  const message = err.message || (data && data.error_description) || 'unknown Graph API error';
  const detail = err.error_data && err.error_data.details;
  const hint = GRAPH_ERROR_HINTS[err.code];

  let text = `${head}${message}`;
  if (detail) text += ` — ${detail}`;
  if (hint) text += ` (${hint})`;
  return text;
}

/**
 * Deliver a one-time password over the WhatsApp Cloud API.
 *
 * Local dev never calls Meta: the code is written to the server console, and
 * returned in the API response only when DEV_ECHO_OTP=true (a production guard
 * in constants.js keeps that off there).
 *
 * @returns {Promise<{devOtp: string|null, messageId: string|null}>}
 */
async function sendWhatsAppOtp(rawPhone, otp) {
  const recipient = toWhatsAppRecipient(rawPhone);
  if (!recipient) {
    throw new Error(`"${rawPhone}" is not a valid WhatsApp phone number`);
  }

  if (config.NODE_ENV !== 'production') {
    console.log(`[WHATSAPP-DEV] OTP for ${recipient}: ${otp}`);
    return { devOtp: config.DEV_ECHO_OTP ? otp : null, messageId: null };
  }

  const token = String(config.WHATSAPP.accessToken || '').trim();
  const phoneNumberId = String(config.WHATSAPP.phoneNumberId || '').trim();
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');

  const url = `${GRAPH_HOST}/${config.WHATSAPP.graphVersion}/${phoneNumberId}/messages`;
  const payload = buildAuthTemplatePayload({ recipient, otp });

  let data;
  try {
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: config.WHATSAPP.timeoutMs,
    });
    data = resp.data;
  } catch (err) {
    if (err.response) {
      const detail = describeGraphError(err.response.data);
      console.error(`[WHATSAPP-API-FAILED] ${recipient}: ${detail}`);
      if (err.response.data) {
        console.error(`[WHATSAPP-RESPONSE] ${JSON.stringify(err.response.data)}`);
      }
      // Surface the Graph detail to the caller: these are configuration
      // problems (bad token, unapproved template, unopted-in user) that are
      // invisible from the client unless they are passed through.
      throw new Error(`WhatsApp rejected the message: ${detail}`);
    }
    // No response: DNS failure, TLS problem, timeout, Render network blip.
    const reason = err.code || err.message || 'network error';
    console.error(`[WHATSAPP-REQUEST-FAILED] ${recipient}: ${reason}`);
    throw new Error(`Could not reach the WhatsApp API: ${reason}`);
  }

  // A 2xx with no messages[] is not a delivery. Treat it as a failure rather
  // than reporting success and letting the user stare at an empty form.
  const messageId = data && Array.isArray(data.messages) && data.messages[0] && data.messages[0].id;
  if (!messageId) {
    console.error(`[WHATSAPP-API-FAILED] ${recipient}: response carried no message id: ${JSON.stringify(data)}`);
    throw new Error('WhatsApp accepted the request but returned no message id');
  }

  console.log(
    `[WHATSAPP-OK] ${config.WHATSAPP.graphVersion} template "${config.WHATSAPP.templateName}" ` +
      `sent to ${recipient}: ${messageId}`,
  );

  return { devOtp: null, messageId };
}

module.exports = { sendWhatsAppOtp, toWhatsAppRecipient, buildAuthTemplatePayload };