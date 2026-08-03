import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password, encoded) {
  const [algorithm, saltHex, hashHex] = String(encoded).split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

