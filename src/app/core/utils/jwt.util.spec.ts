import { adminToken, clientToken, legacyAdminToken, makeToken } from '../../testing/jwt-fixtures';
import { adminRoleOf, decodeJwt, isJwtExpired } from './jwt.util';

describe('decodeJwt', () => {
  it('decodes an administrator sign-in token and reads its roles string as a list', () => {
    const claims = decodeJwt(makeToken({ sub: '60', email: 'super@admin.com', roles: 'SUPER_ADMIN', iat: 1, exp: 2 }));
    expect(claims).toEqual({ sub: '60', email: 'super@admin.com', role: undefined, roles: ['SUPER_ADMIN'], iat: 1, exp: 2 });
  });

  it('keeps the lowercase role claim of the older administrator tokens', () => {
    const claims = decodeJwt(makeToken({ sub: '60', email: 'super@admin.com', role: 'super_admin', iat: 1, exp: 2 }));
    expect(claims).toEqual({ sub: '60', email: 'super@admin.com', role: 'super_admin', roles: undefined, iat: 1, exp: 2 });
  });

  it('decodes the roles array of a client token', () => {
    const claims = decodeJwt(makeToken({ sub: '12', email: 'jane@example.com', roles: ['CLIENT'], iat: 1, exp: 2 }));
    expect(claims?.roles).toEqual(['CLIENT']);
    expect(claims?.role).toBeUndefined();
  });

  it('returns null for malformed input', () => {
    expect(decodeJwt(null)).toBeNull();
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('not.a.jwt.at.all')).toBeNull();
    expect(decodeJwt('a.b')).toBeNull();
    expect(decodeJwt(`x.${btoa('{"sub":1}')}.y`)).toBeNull();
  });
});

describe('adminRoleOf', () => {
  it('reads the administrator role from every token shape Group-12-Auth issues', () => {
    expect(adminRoleOf(decodeJwt(adminToken('super_admin'))!)).toBe('super_admin');
    expect(adminRoleOf(decodeJwt(adminToken('operations'))!)).toBe('operations');
    expect(adminRoleOf(decodeJwt(adminToken('finance'))!)).toBe('finance');
    expect(adminRoleOf({ roles: ['FINANCE'] })).toBe('finance');
    expect(adminRoleOf(decodeJwt(legacyAdminToken('operations'))!)).toBe('operations');
  });

  it('finds no administrator role in client tokens or unknown roles', () => {
    expect(adminRoleOf(decodeJwt(clientToken())!)).toBeNull();
    expect(adminRoleOf({ roles: ['AUDITOR'], role: 'auditor' })).toBeNull();
    expect(adminRoleOf({})).toBeNull();
  });

  it('ignores the older role claim when the token has roles, as Spring does', () => {
    expect(adminRoleOf({ roles: ['CLIENT'], role: 'super_admin' })).toBeNull();
    expect(adminRoleOf({ roles: [], role: 'super_admin' })).toBeNull();
  });
});

describe('isJwtExpired', () => {
  it('compares the exp claim (seconds) with the current time (milliseconds)', () => {
    expect(isJwtExpired({ exp: 1000 }, 999_000)).toBe(false);
    expect(isJwtExpired({ exp: 1000 }, 1_000_000)).toBe(true);
    expect(isJwtExpired({ exp: 1000 }, 998_000, 2000)).toBe(true);
  });
});
