import { ADMIN_ROLES, AdminRole, JwtClaims } from '../models/auth.models';

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
      role: typeof payload.role === 'string' ? payload.role : undefined,
      roles: rolesOf(payload.roles),
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Spring's JwtGrantedAuthoritiesConverter accepts `roles` as a list or a space-separated string, and so does the frontend. */
function rolesOf(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((role): role is string => typeof role === 'string');
  }
  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean);
  }
  return undefined;
}

/**
 * The administrator role a token grants, in any of the shapes Group-12-Auth issues:
 * `roles: 'SUPER_ADMIN'` (sign-in), `roles: ['SUPER_ADMIN']`, or the older `role: 'super_admin'`
 * (refresh). `roles` wins when present, as it is the only claim Spring reads; the older `role`
 * only counts on tokens without it. Null for client tokens and for roles the frontend does not know.
 */
export function adminRoleOf(claims: Pick<JwtClaims, 'role' | 'roles'>): AdminRole | null {
  for (const claim of claims.roles ?? [claims.role]) {
    const role = claim?.trim().toLowerCase();
    if (role && (ADMIN_ROLES as readonly string[]).includes(role)) {
      return role as AdminRole;
    }
  }
  return null;
}

/** True when the token's `exp` (seconds) is in the past, allowing for a small clock skew. */
export function isJwtExpired(claims: Pick<JwtClaims, 'exp'>, nowMs: number = Date.now(), skewMs = 0): boolean {
  return claims.exp * 1000 <= nowMs + skewMs;
}
