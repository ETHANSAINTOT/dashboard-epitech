export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validatePassword(value: string): string | undefined {
  if (value.length < 12 || value.length > 16) return "Between 12 and 16 characters";
  if (!/[A-Z]/.test(value)) return "At least one uppercase letter";
  if (!/[a-z]/.test(value)) return "At least one lowercase letter";
  if (!/[0-9]/.test(value)) return "At least one digit";
  if (!/[^A-Za-z0-9]/.test(value)) return "At least one special character";
  return undefined;
}