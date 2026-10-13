import { JwtClaims } from '../models/auth.models';

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decodes the payload of a JWT without verifying its signature. Verification is the
 * backend's job; the frontend only needs the claims to shape the session.
 */
export function decodeJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Partial<JwtClaims>;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      role: payload.role,
      roles: Array.isArray(payload.roles) ? payload.roles : undefined,
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** True when the token's `exp` (seconds) is in the past, allowing for a small clock skew. */
export function isJwtExpired(claims: Pick<JwtClaims, 'exp'>, nowMs: number = Date.now(), skewMs = 0): boolean {
  return claims.exp * 1000 <= nowMs + skewMs;
}
