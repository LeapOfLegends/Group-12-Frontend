import { makeToken } from '../../testing/jwt-fixtures';
import { decodeJwt, isJwtExpired } from './jwt.util';

describe('decodeJwt', () => {
  it('decodes the claims of an administrator token', () => {
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

describe('isJwtExpired', () => {
  it('compares the exp claim (seconds) with the current time (milliseconds)', () => {
    expect(isJwtExpired({ exp: 1000 }, 999_000)).toBe(false);
    expect(isJwtExpired({ exp: 1000 }, 1_000_000)).toBe(true);
    expect(isJwtExpired({ exp: 1000 }, 998_000, 2000)).toBe(true);
  });
});
