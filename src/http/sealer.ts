import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// What a sealed value is for. Bound in as AES-GCM associated data, so a value sealed for one
// purpose fails to open as another: a client_id can never be replayed as an access token.
export type Purpose = "client" | "request" | "code" | "access";

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts small JSON payloads into opaque, URL-safe strings with AES-256-GCM.
 *
 * Everything the hosted server hands out — client ids, the pending authorization, codes and
 * access tokens — is a sealed value rather than a key into server-side storage. The server
 * therefore holds no state: a restart or a second instance accepts every value the first one
 * issued, and there is no token table to provision, back up or leak.
 */
export class Sealer {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
    }
    this.key = key;
  }

  static fromBase64(value: string): Sealer {
    return new Sealer(Buffer.from(value, "base64"));
  }

  seal(purpose: Purpose, payload: object, ttlMs?: number): string {
    const body = ttlMs === undefined ? payload : { ...payload, exp: Date.now() + ttlMs };
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(purpose));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(body), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  }

  /** Returns null for anything tampered with, sealed for another purpose, or expired. */
  open<T extends object>(purpose: Purpose, value: string): T | null {
    try {
      const raw = Buffer.from(value, "base64url");
      if (raw.length <= IV_BYTES + TAG_BYTES) return null;
      const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, IV_BYTES));
      decipher.setAAD(Buffer.from(purpose));
      decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      const plaintext = Buffer.concat([
        decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]).toString("utf8");
      const body = JSON.parse(plaintext) as T & { exp?: number };
      if (typeof body.exp === "number" && Date.now() > body.exp) return null;
      return body;
    } catch {
      return null;
    }
  }
}
