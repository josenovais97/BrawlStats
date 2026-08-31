import { createPublicKey, verify } from 'node:crypto';

/**
 * Ed25519 signature check for Discord interactions.
 *
 * Discord signs every interaction and requires the endpoint to reject
 * anything that fails — it verifies this before it will even accept the URL,
 * by deliberately sending requests with bad signatures and checking they come
 * back 401. An endpoint that answers those is refused outright.
 *
 * No library for it: Node verifies Ed25519 natively. The only fiddly part is
 * that Discord publishes a raw 32-byte key while `createPublicKey` wants DER,
 * so the key is wrapped in the fixed SPKI header for Ed25519 below.
 */

/** SPKI prefix for an Ed25519 public key; the raw 32 bytes follow it. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function publicKeyFrom(hex: string) {
  const raw = Buffer.from(hex, 'hex');
  if (raw.length !== 32) throw new Error('Discord public key must be 32 bytes');
  return createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

/**
 * True when the body genuinely came from Discord.
 *
 * `body` must be the raw text exactly as sent: the signature covers the bytes,
 * so parsing and re-serialising the JSON first would change them and every
 * check would fail.
 */
export function verifyDiscordRequest(
  publicKeyHex: string,
  signature: string | null,
  timestamp: string | null,
  body: string,
): boolean {
  if (!signature || !timestamp) return false;
  try {
    return verify(
      null,
      Buffer.from(timestamp + body),
      publicKeyFrom(publicKeyHex),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    // A malformed signature or key is a failed check, not a crash.
    return false;
  }
}
