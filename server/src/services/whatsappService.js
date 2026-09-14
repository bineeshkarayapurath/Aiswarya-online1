const crypto = require('crypto');
const config = require('../config/constants');

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function sendWhatsAppMessage(toPhone, body) {
  if (!config.WHATSAPP.enabled) {
    // DEV MODE fallback: return the OTP so flows can be tested without WhatsApp.
    // eslint-disable-next-line no-console
    console.log(
      `[DEV-MODE] WhatsApp message to ${toPhone}: ${body.replace(/\n/g, ' | ')}`
    );
    const otpMatch = body.match(/\b\d{6}\b/);
    return { devOtp: otpMatch ? otpMatch[0] : null };
  }

  const url = `${config.WHATSAPP.apiUrl}/${config.WHATSAPP.phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'text',
    text: { body },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.WHATSAPP.token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`WhatsApp API error: ${resp.status} ${errText}`);
  }

  return { devOtp: null };
}

function buildOtpMessage(clubName, otp, minutes) {
  return `Your ${clubName} verification code is ${otp}. It is valid for ${minutes} minutes. Do not share this code with anyone.`;
}

module.exports = {
  generateOtp,
  sendWhatsAppMessage,
  buildOtpMessage,
};