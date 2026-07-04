const bcrypt = require('bcryptjs');

class PasswordService {
  static async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, 12);
  }

  static async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }

  static validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain number');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain special character (!@#$%^&* etc)');
    }

    return {
      valid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak',
    };
  }
}

module.exports = PasswordService;
