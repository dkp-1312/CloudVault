// ============================================================
// Auth helpers — Password gate + localStorage persistence
// ============================================================

const STORAGE_KEY = 'cloudinary_manager_auth';

/**
 * Compare user-entered password with .env value.
 * Returns true if they match.
 */
export function checkPassword(input) {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('VITE_ADMIN_PASSWORD is not set in .env');
    return false;
  }
  return input === adminPassword;
}

/**
 * Save a successful auth session to localStorage.
 * Stores a timestamp so we could add expiry later.
 */
export function saveAuth() {
  const record = {
    authenticated: true,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/**
 * Check if the user has already authenticated.
 * Returns true if a valid auth record exists in localStorage.
 */
export function isAuthenticated() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const record = JSON.parse(raw);
    return record?.authenticated === true;
  } catch {
    return false;
  }
}

/**
 * Clear the auth session (logout).
 */
export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}
