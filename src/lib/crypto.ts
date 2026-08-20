// Locks/unlocks the saved session file. AES-256-GCM: a well-established
// "authenticated encryption" mode — it doesn't just hide the data, it also
// detects if the file was tampered with (decryption fails loudly instead of
// silently returning corrupted data).
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.SESSION_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY is not set. Copy .env.example to .env and " +
        "generate a real key (see the comment in that file)."
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `SESSION_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes.`
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // GCM's recommended IV length
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Store iv + authTag + ciphertext together, base64, so it's one blob to
  // write to disk.
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(blob: string): string {
  const key = getKey();
  const data = Buffer.from(blob, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if the file was tampered with or the key is wrong
  ]);
  return plaintext.toString("utf-8");
}
