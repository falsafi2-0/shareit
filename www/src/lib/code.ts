// Generate a random 6-digit numeric code
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validate a 6-digit code format
export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
