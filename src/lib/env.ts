/** Centralised, lazily-read environment access. Nothing here is ever sent to the browser. */

export function appUrl(): string | null {
  const v = process.env.APP_URL?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}

export function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "true";
}
