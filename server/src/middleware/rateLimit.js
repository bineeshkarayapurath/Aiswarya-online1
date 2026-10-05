const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Throttling for the unauthenticated credential endpoints.
//
// Why this matters most on set-password: that endpoint is protected only by the
// member's date of birth, which is not a secret. It is printed on ID cards and
// receipts and passed around in club WhatsApp groups. Without a limit, anyone
// who knows a member's phone number could enumerate dates of birth against
// /auth/set-password and set a password of their choosing.
//
// Two deliberate choices keep this from becoming a way to lock members out:
//
// 1. Only FAILED attempts count. A member who types their password correctly is
//    never throttled, however many times they sign in.
//
// 2. 403 is not a failure here. The login endpoint returns 403 to mean "these
//    credentials are valid, but the application is still pending" - that is a
//    success as far as authentication is concerned, and counting it would
//    throttle a pending member for being pending. Genuine credential failures
//    are 401 (wrong password, wrong date of birth) and 400 (policy rejection).
const AUTH_FAILURE_STATUSES = new Set([400, 401]);

// Deliberately generous. A wrong password on a shared wifi, or a member
// transposing digits a few times in a row, must never lock anybody out of a
// meeting. This is here to make an automated sweep impractical, not to police
// typos.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 15;

const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_FAILURES,
  skipSuccessfulRequests: true,
  // Must use requestWasSuccessful rather than a custom skip(): `skip` is evaluated
  // BEFORE the route handler runs, so res.statusCode is still 200 and every request
  // would be treated as a success, counting nothing at all.
  //
  // 403 is deliberately not a failure here. The login endpoint returns 403 to mean
  // "these credentials are valid, but the application is still pending" - a success
  // as far as authentication goes, and counting it would throttle a pending member
  // for being pending. Genuine credential failures are 401 (wrong password, wrong
  // date of birth) and 400 (policy rejection).
  requestWasSuccessful: (req, res) => !AUTH_FAILURE_STATUSES.has(res.statusCode),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Plain-English message. A member hitting this should know how long to wait
  // rather than seeing a bare "Too many requests".
  message: {
    message:
      'Too many failed sign-in attempts from your device. Please wait 15 minutes and try again. If you have not set a password yet, contact the club office.',
  },
  handler: (req, res, next, options) => {
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
    res.status(options.statusCode).json(options.message);
  },
});

// Coarse per-IP brake on the AI Book Assistant, layered over the controller's
// per-member hourly quota. Unlike authLimiter this counts every request,
// including successes, because each one bills the provider. Keyed per user id
// when available so a whole club hall on one wifi does not share a budget, with
// the IP as the fallback for unauthenticated traffic.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req, res) => {
    const id = req.user && req.user._id;
    // ipKeyGenerator (not raw req.ip) normalises IPv6 to its /64 subnet, so a
    // client cycling through its own address space cannot reset the counter.
    return id ? `u${id}` : `ip${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many questions at once. Please wait a minute and try again.',
  },
  handler: (req, res, next, options) => {
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { authLimiter, aiLimiter, WINDOW_MS, MAX_FAILURES };
