import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) throw new Error("Invalid base32.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function totpCode(secret: Buffer, atMs: number, step = 30, digits = 6): string {
  const counter = Math.floor(atMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpMatches(secret: Buffer, code: string, atMs: number): boolean {
  const cleaned = code.trim();
  return totpCode(secret, atMs) === cleaned || totpCode(secret, atMs - 30_000) === cleaned;
}
