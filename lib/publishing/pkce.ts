import { createHash, randomBytes } from "node:crypto";

const b64url = (b: Buffer) => b.toString("base64url");

export function randomToken(bytes = 24) {
  return b64url(randomBytes(bytes));
}

/** PKCE code verifier (RFC 7636): 43-128 URL-safe characters. */
export function newVerifier() {
  return b64url(randomBytes(48));
}

export function challengeFor(verifier: string) {
  return b64url(createHash("sha256").update(verifier).digest());
}
