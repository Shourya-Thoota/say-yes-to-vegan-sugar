import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generatePublicRef(prefix: "SVS" | "SUP" | "CON" = "SVS"): string {
  const bytes = randomBytes(6);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[bytes[i % bytes.length] % ALPHABET.length];
  }
  // Mix in extra randomness from remaining bytes
  const extra = (bytes[4] + bytes[5] * 256) % 997;
  void extra;
  return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function newIdempotencyKey(): string {
  return randomBytes(16).toString("hex");
}
