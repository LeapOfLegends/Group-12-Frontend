import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { makeToken } from '../../testing/jwt-fixtures';
import { AuthService } from './auth.service';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 60;

const ADMIN_RESPONSE = {
  accessToken: makeToken({
    sub: '60',
    email: 'super@admin.com',
    role: 'super_admin',
    iat: FUTURE - 3600,
    exp: FUTURE,
  }),
  admin: {
    adminId: '60',
    firstName: 'Super',
    lastName: 'Admin',
    email: 'super@admin.com',
    role: 'super_admin',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
};

const CLIENT_RESPONSE = {
  accessToken: makeToken({
    sub: '12',
    email: 'jane@example.com',
    roles: ['CLIENT'],
    iat: FUTURE - 3600,
    exp: FUTURE,
  }),
  client: {
    clientId: '12',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phoneNumber: '202-456-1111',
    dateOfBirth: '1990-05-15',
    accountBalance: '0',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
};

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('logs an administrator in, derives the role from the token and persists the session', () => {
    const auth = TestBed.inject(AuthService);
    let sessionKind = '';
    auth
      .login({ email: 'super@admin.com', password: 'secret' })
      .subscribe((session) => (sessionKind = session.user.kind));

    const request = http.expectOne(`${environment.authApiUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'super@admin.com', password: 'secret' });
    request.flush(ADMIN_RESPONSE);

    expect(sessionKind).toBe('admin');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(auth.isClient()).toBe(false);
    expect(auth.role()).toBe('super_admin');
    expect(auth.canManageAdmins()).toBe(true);
    expect(auth.canViewTradingOperations()).toBe(true);
    expect(auth.canViewFinancialOperations()).toBe(true);
    expect(auth.user()?.displayName).toBe('Super Admin');
    expect(auth.user()?.id).toBe(60);
    expect(
      JSON.parse(localStorage.getItem(environment.sessionStorageKey) ?? '{}').accessToken,
    ).toBe(ADMIN_RESPONSE.accessToken);
  });

  it('logs a client in without administrator permissions', () => {
    const auth = TestBed.inject(AuthService);
    auth.login({ email: 'jane@example.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.authApiUrl}/auth/login`).flush(CLIENT_RESPONSE);

    expect(auth.isClient()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.role()).toBeNull();
    expect(auth.canManageAdmins()).toBe(false);
    expect(auth.canViewTradingOperations()).toBe(false);
    expect(auth.user()).toMatchObject({
      id: 12,
      email: 'jane@example.com',
      firstName: 'Jane',
      kind: 'client',
    });
  });

  it('restores a valid stored session on startup and drops an expired one', () => {
    localStorage.setItem(
      environment.sessionStorageKey,
      JSON.stringify({
        accessToken: CLIENT_RESPONSE.accessToken,
        user: {
          kind: 'client',
          id: 12,
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          displayName: 'Jane Doe',
          role: null,
          createdAt: null,
        },
        expiresAt: FUTURE * 1000,
        issuedAt: 0,
      }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.displayName).toBe('Jane Doe');

    auth.clearSession();
    localStorage.setItem(
      environment.sessionStorageKey,
      JSON.stringify({
        accessToken: makeToken({ sub: '12', email: 'x@y.z', roles: ['CLIENT'], iat: 0, exp: PAST }),
        user: {},
        expiresAt: PAST * 1000,
        issuedAt: 0,
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fresh = TestBed.inject(AuthService);
    expect(fresh.isAuthenticated()).toBe(false);
    expect(fresh.hasSession()).toBe(false);
    expect(localStorage.getItem(environment.sessionStorageKey)).toBeNull();
  });

  it('rejects a login response whose token is already expired', () => {
    const auth = TestBed.inject(AuthService);
    let failure: unknown = null;
    auth
      .login({ email: 'jane@example.com', password: 'secret' })
      .subscribe({ error: (error: unknown) => (failure = error) });
    http.expectOne(`${environment.authApiUrl}/auth/login`).flush({
      ...CLIENT_RESPONSE,
      accessToken: makeToken({
        sub: '12',
        email: 'jane@example.com',
        roles: ['CLIENT'],
        iat: 0,
        exp: PAST,
      }),
    });
    expect(failure).toBeInstanceOf(Error);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('logs out by clearing storage and navigating to the login page', () => {
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.login({ email: 'jane@example.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.authApiUrl}/auth/login`).flush(CLIENT_RESPONSE);

    auth.logout('expired');

    expect(auth.hasSession()).toBe(false);
    expect(localStorage.getItem(environment.sessionStorageKey)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });
  it('registers a client through POST /auth/register without starting a session', () => {
    const auth = TestBed.inject(AuthService);
    const request = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'ClientPassword123!',
      ssn: '123-45-6789',
      phoneNumber: '202-456-1111',
      dateOfBirth: '1990-05-15',
    };
    let created: unknown = null;
    auth.register(request).subscribe((client) => (created = client));

    const call = http.expectOne(`${environment.authApiUrl}/auth/register`);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush(CLIENT_RESPONSE.client, { status: 201, statusText: 'Created' });

    expect(created).toMatchObject({ clientId: '12', email: 'jane@example.com' });
    expect(auth.hasSession()).toBe(false);
  });
});
