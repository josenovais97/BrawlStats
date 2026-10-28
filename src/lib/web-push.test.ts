import assert from 'node:assert/strict';
import { createDecipheriv, createECDH, createPublicKey, generateKeyPairSync, hkdfSync, randomBytes, verify } from 'node:crypto';
import { test } from 'node:test';

import { encryptPayload, vapidHeader } from '@/lib/web-push';

test('a browser can decrypt what we send (RFC 8291 round trip)', () => {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const sub = { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') };
  const body = encryptPayload(sub, Buffer.from('{"title":"🎁 Mega Box"}'));

  // The receiving side, as a browser does it.
  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  const idlen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([d.update(ciphertext.subarray(0, ciphertext.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  assert.equal(plain.subarray(0, -1).toString(), '{"title":"🎁 Mega Box"}');
});

test('the VAPID token is a valid ES256 JWT for the push service origin', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')]).toString('base64url');
  const h = vapidHeader('https://fcm.googleapis.com/fcm/send/abc', pub, JSON.stringify(jwk), 'mailto:x@y.z', 1_000_000_000_000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.ok(m);
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, 1_000_000_000 + 12 * 3600);
  const ok = verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: createPublicKey(privateKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url'));
  assert.ok(ok, 'signature verifies');
  assert.equal(m[4], pub);
});
