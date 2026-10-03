const crypto = require('crypto');
const config = require('../config/constants');

// Cryptographically secure numeric OTP. Only 4 and 6 digits are supported
// because those are the only lengths the OTP entry field will accept; anything
// else is coerced to 6. crypto.randomInt is rejection-sampled, so there is no
// modulo bias (unlike Math.random * range).
function generateOtp(digits = config.OTP_DIGITS) {
  const size = digits === 4 ? 4 : 6;
  const min = size === 4 ? 1000 : 100000;
  const max = size === 4 ? 9999 : 999999;
  return String(crypto.randomInt(min, max + 1)).padStart(size, '0');
}

module.exports = { generateOtp };