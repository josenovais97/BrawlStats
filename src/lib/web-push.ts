import { createECDH, createPrivateKey, createCipheriv, hkdfSync, randomBytes, sign } from 'node:crypto';

/**
 * Web push without a dependency (2026-10-28): message encryption per RFC 8291
 * (aes128gcm, RFC 8188) and VAPID (RFC 8292), on Node's own crypto. It is
 * ~60 lines against a library pulled into the image for one job, and the
 * test round-trips a message the way a browser decrypts it.
 */

export interface PushSubscriptionKeys {
  endpoint: string;
  /** The browser's P-256 public key, base64url, 65 bytes uncompressed. */
  p256dh: string;
  /** 16 bytes, base64url. */
  auth: string;
}

const b64u = (b: Buffer) => b.toString('base64url');

/** The encrypted body: salt, record size, our key, then one AES-GCM record. */
export function encryptPayload(
  sub: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  payload: Buffer,
  salt: Buffer = randomBytes(16),
): Buffer {
  // A fresh key pair per message, as the RFC requires.
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const uaPublic = Buffer.from(sub.p256dh, 'base64url');
  const authSecret = Buffer.from(sub.auth, 'base64url');
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 marks the last (and only) record; no padding after it.
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

/** "vapid t=<jwt>, k=<public key>" for one push service's origin. */
export function vapidHeader(endpoint: string, publicKey: string, privateJwk: string, subject: string, now = Date.now()): string {
  const enc = (o: object) => b64u(Buffer.from(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: subject,
  })}`;
  const key = createPrivateKey({ key: JSON.parse(privateJwk), format: 'jwk' });
  const sig = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${publicKey}`;
}

export type SendResult = 'sent' | 'gone' | 'failed';

/** One notification. "gone" (404/410) means the browser unsubscribed: delete it. */
export async function sendPush(sub: PushSubscriptionKeys, message: object, ttlSeconds = 86_400): Promise<SendResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateJwk = process.env.VAPID_PRIVATE_JWK;
  if (!publicKey || !privateJwk) throw new Error('VAPID keys missing');
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(sub.endpoint, publicKey, privateJwk, 'mailto:contact@brawlzone.net'),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSeconds),
      Urgency: 'high',
    },
    body: new Uint8Array(encryptPayload(sub, Buffer.from(JSON.stringify(message)))),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) return 'failed';
  if (res.status === 404 || res.status === 410) return 'gone';
  return res.ok ? 'sent' : 'failed';
}
