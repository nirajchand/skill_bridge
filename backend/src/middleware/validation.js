const Joi = require('joi');
const PasswordService = require('../services/passwordService');

async function validateRegister(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(12).required().messages({
      'string.min': 'Password must be at least 12 characters',
      'any.required': 'Password is required',
    }),
    role: Joi.string().valid('client', 'freelancer').required().messages({
      'any.only': 'Role must be client or freelancer',
      'any.required': 'Role is required',
    }),
    // CAPTCHA fields must be declared: Joi rejects unknown keys by default, so
    // omitting them here would fail the request before the CAPTCHA is checked.
    // Verified in routes/auth.js, not here — this only permits them through.
    captchaToken: Joi.string().allow('', null),
    captchaAnswer: Joi.string().allow('', null),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const strength = PasswordService.validatePasswordStrength(value.password);
  if (!strength.valid) {
    return res.status(400).json({ error: 'Password too weak', details: strength.errors });
  }

  req.validatedData = value;
  next();
}

function validateLogin(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    // Optional here: only demanded once an account looks under attack
    // (see CAPTCHA_AFTER_FAILURES in routes/auth.js).
    captchaToken: Joi.string().allow('', null),
    captchaAnswer: Joi.string().allow('', null),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  req.validatedData = value;
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
};
