import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.DRIVE_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('DRIVE_TOKEN_SECRET (or SESSION_SECRET fallback) must be set for token encryption');
  }
  // Derive a 32-byte key from the secret
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as base64: iv + tag + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  const buf = Buffer.from(cipherText, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Encrypted payload too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
