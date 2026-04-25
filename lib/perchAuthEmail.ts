/**
 * Internal email domain for Supabase Auth only. Never shown in the UI.
 * Uses a conventional TLD so validators accept the synthetic address.
 */
const EMAIL_DOMAIN = "perchcapital.app";

/**
 * Deterministic mapping: visible username -> valid-looking email for Supabase.
 * Same function is used for sign up and sign in.
 */
export function usernameToEmail(username: string): string {
  const slug = normalizeUsername(username);
  return `${slug}@${EMAIL_DOMAIN}`;
}

/**
 * Lowercase, trim, remove characters that are not allowed in the email local part.
 * Keeps a-z, 0-9, underscore (valid in dot-atom per RFC 5322).
 */
export function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

/** Max length for stored username and email local part (stay under RFC 64). */
const USERNAME_MAX = 20;

/** 3 to 20 chars: letters, numbers, underscore only (before normalization). */
export function validateUsernameFormat(username: string): string | null {
  const raw = username.trim();
  if (raw.length < 3 || raw.length > USERNAME_MAX) {
    return "Choose a username between 3 and 20 characters.";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) {
    return "Use letters, numbers, or underscores only.";
  }
  const slug = normalizeUsername(username);
  if (slug.length < 3) {
    return "Your username needs at least 3 letters or numbers.";
  }
  return null;
}

export function validatePasswordFormat(password: string): string | null {
  if (password.length < 8) {
    return "Use at least 8 characters for your password.";
  }
  return null;
}

/** Maps Supabase auth errors to friendly copy without exposing internal email. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid") && (m.includes("email") || m.includes("address"))) {
    return "That username could not be used. Try letters and numbers only, or pick a different name.";
  }
  if (m.includes("already registered") || m.includes("user already")) {
    return "That username is already taken. Try another one.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Username or password did not match. Check and try again.";
  }
  return message;
}
