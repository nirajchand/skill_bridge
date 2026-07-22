export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/.test(password);
}

export function isValidTaskTitle(title: string): boolean {
  return title.trim().length > 0 && title.length <= 200;
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export function validatePassword(password: string): {
  valid: boolean;
  strength: PasswordStrength;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Minimum 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Needs uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Needs lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Needs number');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push('Needs special character');

  const strength: PasswordStrength = errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak';

  return { valid: errors.length === 0, strength, errors };
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword;
}
