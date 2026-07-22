const Joi = require('joi');

const CATEGORIES = ['writing', 'design', 'development', 'marketing', 'data', 'other'];
const DISPUTE_REASONS = [
  'Work not as agreed',
  'Freelancer unresponsive',
  'Client unresponsive',
  'Quality issue',
  'Scope mismatch',
  'Payment not released',
  'Other'
];

const price = Joi.number().min(5).max(100000);

const createTask = Joi.object({
  title: Joi.string().trim().min(5).max(200).required().messages({ 'string.min': 'Title must be between 5 and 200 characters' }),
  description: Joi.string().trim().min(10).max(5000).required().messages({ 'string.min': 'Description must be between 10 and 5000 characters' }),
  category: Joi.string().valid(...CATEGORIES).required().messages({ 'any.only': 'Invalid category' }),
  price: price.required().messages({ 'number.min': 'Price must be between $5 and $100,000', 'number.max': 'Price must be between $5 and $100,000' }),
  deadline: Joi.date().iso().allow(null, ''),
  skills_required: Joi.string().max(500).allow(null, '')
});

const updateTask = Joi.object({
  title: Joi.string().trim().min(5).max(200),
  description: Joi.string().trim().min(10).max(5000),
  category: Joi.string().valid(...CATEGORIES),
  price,
  deadline: Joi.date().iso().allow(null, ''),
  skills_required: Joi.string().max(500).allow(null, '')
}).min(1);

const applyToTask = Joi.object({
  task_id: Joi.string().uuid().required(),
  cover_letter: Joi.string().max(2000).allow(null, ''),
  proposed_price: price.allow(null, '')
});

const handleApplication = Joi.object({
  action: Joi.string().valid('accept', 'reject').required().messages({ 'any.only': 'action must be "accept" or "reject"' })
});

const raiseDispute = Joi.object({
  contract_id: Joi.string().uuid().required(),
  reason: Joi.string().valid(...DISPUTE_REASONS).required().messages({ 'any.only': 'Please select a valid reason' }),
  description: Joi.string().trim().min(20).required().messages({ 'string.min': 'Description must be at least 20 characters' })
});

// Single source of truth for editable profile fields. Shared by the normal
// profile editor AND the privacy import, so an uploaded file can never bypass
// the rules the UI enforces.
const PROFILE_FIELDS = {
  display_name: Joi.string().trim().min(2).max(100),
  bio: Joi.string().max(500).allow(null, ''),
  location: Joi.string().max(100).allow(null, ''),
  skills: Joi.array().items(Joi.string().trim().min(2).max(50)).max(10),
  hourly_rate: Joi.number().min(5).max(500).allow(null, ''),
  portfolio_url: Joi.string().uri({ scheme: ['http', 'https'] }).allow(null, ''),
  company_name: Joi.string().max(200).allow(null, ''),
  company_website: Joi.string().uri({ scheme: ['http', 'https'] }).allow(null, '')
};

const updateProfile = Joi.object(PROFILE_FIELDS).min(1);

const resolveDispute = Joi.object({
  resolution_type: Joi.string().valid('release', 'refund', 'split').required(),
  split_freelancer_percentage: Joi.number().min(0).max(100).when('resolution_type', {
    is: 'split',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  admin_notes: Joi.string().trim().min(20).required().messages({ 'string.min': 'admin_notes must be at least 20 characters' })
});

const submitWork = Joi.object({
  description: Joi.string().trim().min(5).required().messages({ 'string.min': 'Please describe what you are submitting' }),
  files_url: Joi.string().max(1000).allow(null, '')
});

const requestRevision = Joi.object({
  revision_notes: Joi.string().trim().min(5).required().messages({ 'string.min': 'Please describe the revisions you need' })
});

const payoutRequest = Joi.object({
  amount: Joi.number().positive().allow(null, '')
});

/**
 * Import re-validates the uploaded file with the SAME rules as the profile
 * editor. Because validate() runs with stripUnknown:true, every other key in the
 * file is silently DROPPED — including dangerous ones like `role`, `is_verified`
 * or `password_hash`, and the tasks/contracts/payments sections. So an attacker
 * editing their export file cannot escalate privileges or fabricate records:
 * only the eight fields below can ever reach the database.
 */
const privacyImport = Joi.object({
  account: Joi.object(PROFILE_FIELDS).required()
});

const changePassword = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(12).max(72).required().messages({
    'string.min': 'Password must be at least 12 characters',
    'string.max': 'Password must be at most 72 bytes'
  })
});

const mfaEnable = Joi.object({ token: Joi.string().trim().required() });
const mfaVerifyLogin = Joi.object({
  mfaToken: Joi.string().required(),
  code: Joi.string().trim().required(),
  isBackupCode: Joi.boolean().default(false)
});

module.exports = {
  privacyImport,
  changePassword,
  createTask,
  updateTask,
  applyToTask,
  handleApplication,
  raiseDispute,
  updateProfile,
  resolveDispute,
  submitWork,
  requestRevision,
  payoutRequest,
  mfaEnable,
  mfaVerifyLogin
};
