import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { makeToken } from '../../testing/jwt-fixtures';
import { describeHttpError } from '../utils/http-error';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function seedSession(exp = FUTURE): string {
  const token = makeToken({ sub: '12', email: 'jane@example.com', roles: ['CLIENT'], iat: 0, exp });
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: token,
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
      expiresAt: exp * 1000,
      issuedAt: 0,
    }),
  );
  return token;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('adds the bearer token to trading and auth API calls only', () => {
    const token = seedSession();
    configure();
    http.get(`${environment.tradingApiUrl}/api/clients/me/balance`).subscribe();
    http.get('https://fonts.example.com/inter.css').subscribe();

    expect(
      backend
        .expectOne(`${environment.tradingApiUrl}/api/clients/me/balance`)
        .request.headers.get('Authorization'),
    ).toBe(`Bearer ${token}`);
    expect(
      backend.expectOne('https://fonts.example.com/inter.css').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('does not attach a stale token to the login or registration calls', () => {
    seedSession();
    configure();
    http.post(`${environment.authApiUrl}/auth/login`, {}).subscribe({ error: () => undefined });
    http.post(`${environment.authApiUrl}/auth/register`, {}).subscribe({ error: () => undefined });

    const login = backend.expectOne(`${environment.authApiUrl}/auth/login`);
    const register = backend.expectOne(`${environment.authApiUrl}/auth/register`);
    expect(login.request.headers.has('Authorization')).toBe(false);
    expect(register.request.headers.has('Authorization')).toBe(false);
    login.flush(
      { statusCode: 401, message: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' },
    );
    register.flush(
      { statusCode: 400, message: ['email must be an email'] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(auth.hasSession()).toBe(true);
  });

  it('ends the session when a backend rejects a token that is about to expire', () => {
    seedSession(Math.floor(Date.now() / 1000) + 30);
    configure();
    const logout = vi.spyOn(auth, 'logout');
    let status = 0;
    http
      .get(`${environment.tradingApiUrl}/instruments`)
      .subscribe({ error: (error) => (status = error.status) });
    backend
      .expectOne(`${environment.tradingApiUrl}/instruments`)
      .flush(
        { status: 401, message: 'Invalid or expired token' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(status).toBe(401);
    expect(logout).toHaveBeenCalledWith('expired');
    expect(auth.hasSession()).toBe(false);
  });

  it('keeps a valid session when the trading API rejects the token and explains the likely cause', () => {
    seedSession();
    configure();
    const logout = vi.spyOn(auth, 'logout');
    let failure: unknown = null;
    http
      .get(`${environment.tradingApiUrl}/instruments`)
      .subscribe({ error: (error: unknown) => (failure = error) });
    backend
      .expectOne(`${environment.tradingApiUrl}/instruments`)
      .flush(
        { status: 401, message: 'Invalid or expired token' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(logout).not.toHaveBeenCalled();
    expect(auth.hasSession()).toBe(true);
    expect(describeHttpError(failure)).toContain('JWT_SECRET');
  });

  it('leaves other errors to the caller', () => {
    seedSession();
    configure();
    const logout = vi.spyOn(auth, 'logout');
    http.get(`${environment.tradingApiUrl}/instruments`).subscribe({ error: () => undefined });
    backend
      .expectOne(`${environment.tradingApiUrl}/instruments`)
      .flush({ message: 'nope' }, { status: 403, statusText: 'Forbidden' });
    expect(logout).not.toHaveBeenCalled();
    expect(auth.hasSession()).toBe(true);
  });
});
