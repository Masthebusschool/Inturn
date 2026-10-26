// Same email rule as the server, so users get instant feedback before submitting.
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(email.trim())
}

// Same password policy as the server (8 characters, 1 upper, 1 lower, 1 digit).
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (password) => password.length >= 8 },
  { label: 'At least 1 uppercase letter', test: (password) => /[A-Z]/.test(password) },
  { label: 'At least 1 lowercase letter', test: (password) => /[a-z]/.test(password) },
  { label: 'At least 1 number', test: (password) => /[0-9]/.test(password) },
]
