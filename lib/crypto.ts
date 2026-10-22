import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function parseKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== KEY_BYTES) throw new Error(`TOKEN_KEY must be ${KEY_BYTES} bytes, base64`);
  return key;
}

// AES-256-GCM. Output: base64(iv | tag | ciphertext). Key: 32 bytes, base64, from TOKEN_KEY.
export function encrypt(plain: string, keyBase64: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", parseKey(keyBase64), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decrypt(blob: string, keyBase64: string): string {
  const bytes = Buffer.from(blob, "base64");
  const decipher = createDecipheriv("aes-256-gcm", parseKey(keyBase64), bytes.subarray(0, IV_BYTES));
  decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}
