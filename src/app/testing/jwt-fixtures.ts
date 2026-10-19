/** Test-only helpers for building unsigned JWTs shaped like the ones Group-12-Auth issues. */

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function makeToken(payload: Record<string, unknown>): string {
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

export const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600;

export function clientToken(id = 12, email = 'jane@example.com'): string {
  return makeToken({ sub: String(id), email, roles: ['CLIENT'], iat: 0, exp: FUTURE_EXP });
}

export function adminToken(role: 'super_admin' | 'operations' | 'finance', id = 60, email = 'super@admin.com'): string {
  return makeToken({ sub: String(id), email, role, iat: 0, exp: FUTURE_EXP });
}
