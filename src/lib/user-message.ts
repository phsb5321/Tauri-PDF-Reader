/**
 * User-visible message boundary (issue #294).
 *
 * Internal errors carry machine codes as a leading `CODE: ` prefix because
 * they double as control-flow signals (`HASH_MISMATCH` routes
 * reauthorization, `isScopeDenial` classifies scope errors, session codes
 * decide rollback). Those codes must never reach a rendered string — this is
 * the single strip point every message crosses on its way to `setError`,
 * `onError`, or a status banner.
 *
 * @module lib/user-message
 */

const CODE_PREFIX = /^[A-Z][A-Z0-9_]*:\s*/;

/**
 * Strip a leading internal code from a message and return the friendly
 * remainder. Already-friendly strings pass through unchanged.
 */
export function friendlyError(message: string): string {
  const stripped = message.replace(CODE_PREFIX, "").trim();
  return stripped.length > 0 ? stripped : message.trim();
}
