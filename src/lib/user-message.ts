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
 * Strip every leading internal code from a message and return the friendly
 * remainder. Codes nest — one coded error can wrap another
 * (`HTTP_ERROR: API_ERROR: …`) — so the strip loops until stable.
 * Already-friendly strings pass through unchanged.
 */
export function friendlyError(message: string): string {
  let stripped = message.trim();
  while (CODE_PREFIX.test(stripped)) {
    stripped = stripped.replace(CODE_PREFIX, "").trim();
  }
  return stripped.length > 0 ? stripped : message.trim();
}
