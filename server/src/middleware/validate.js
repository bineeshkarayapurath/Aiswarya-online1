const { body, validationResult } = require('express-validator');
const config = require('../config/constants');

// Request-body validation for the unauthenticated credential endpoints.
//
// Two things happen here beyond "is the field present":
//
//  1. Type/format enforcement. Every value the controllers then feed into a
//     Mongoose query is coerced to a plain string and trimmed first, so a body
//     like {"phone":{"$gt":""}} cannot arrive as a query operator — the classic
//     NoSQL-injection vector. Mongoose would also cast it away, but rejecting it
//     at the edge is cheaper and gives a clear 400 instead of a silent miss.
//
//  2. Bounds. Length caps stop an oversized payload from being stored (and, for
//     passwords, keep the bcrypt 72-byte truncation rule honest).
//
// Deliberately NOT escaping HTML entities here: the values are stored raw and
// rendered by React, which encodes output by default. Escaping on input would
// corrupt legitimate names (O'Brien -> O&#39;Brien) in the database and PDFs
// without adding protection. Output encoding is the correct defence for XSS.
function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) return next();
      const errors = result.array();
      return res.status(400).json({
        message: errors[0].msg,
        errors: errors.map((e) => ({ field: e.path, message: e.msg })),
      });
    },
  ];
}

const passwordRules = (field, { required }) => {
  let chain = required ? body(field).exists({ checkFalsy: true }) : body(field).optional({ nullable: true });
  return [
    chain.withMessage('Password is required').isString().withMessage('Password must be text'),
    body(field)
      .isLength({ min: config.PASSWORD.minLength })
      .withMessage(`Password must be at least ${config.PASSWORD.minLength} characters`),
    body(field)
      .isLength({ max: config.PASSWORD.maxLength })
      .withMessage(`Password must be at most ${config.PASSWORD.maxLength} characters`),
  ];
};

const confirmMatches = () =>
  body('confirmPassword')
    .optional({ nullable: true })
    .custom((value, { req }) => value == null || String(value) === String(req.body.password))
    .withMessage('Passwords do not match');

const registerRules = validate([
  body('identifier')
    .exists({ checkFalsy: true })
    .withMessage('Phone number is required')
    .isString()
    .trim(),
  body('fullName')
    .exists({ checkFalsy: true })
    .withMessage('Full name is required')
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Full name is too long'),
  body('dob')
    .exists({ checkFalsy: true })
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth is invalid'),
  body('address')
    .exists({ checkFalsy: true })
    .withMessage('Address is required')
    .isString()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Address is too long'),
  ...passwordRules('password', { required: true }),
  confirmMatches(),
  body('email').optional({ nullable: true }).isString().trim().isLength({ max: 160 }),
  body('occupation').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('education').optional({ nullable: true }).isString().trim().isLength({ max: 160 }),
  body('recommenderName').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('recommenderMemberId').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
]);

const loginRules = validate([
  body('identifier').exists({ checkFalsy: true }).withMessage('Phone number is required').isString().trim(),
  body('password').optional({ nullable: true }).isString().isLength({ max: config.PASSWORD.maxLength }),
]);

const setPasswordRules = validate([
  body('identifier').exists({ checkFalsy: true }).withMessage('Phone number is required').isString().trim(),
  ...passwordRules('password', { required: true }),
  confirmMatches(),
  body('dob')
    .exists({ checkFalsy: true })
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth is invalid'),
]);

const adminLoginRules = validate([
  body('phone').exists({ checkFalsy: true }).withMessage('Phone number is required').isString().trim(),
  body('password').optional({ nullable: true }).isString().isLength({ max: config.PASSWORD.maxLength }),
]);

module.exports = { validate, registerRules, loginRules, setPasswordRules, adminLoginRules };
