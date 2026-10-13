import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { makeToken } from '../../testing/jwt-fixtures';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = makeToken({ sub: '12', email: 'jane@example.com', roles: ['CLIENT'], iat: 0, exp: FUTURE });

function seedSession(): void {
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: TOKEN,
      user: { kind: 'client', id: 12, email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', displayName: 'Jane Doe', role: null, createdAt: null },
      expiresAt: FUTURE * 1000,
      issuedAt: 0,
    }),
  );
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    seedSession();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('adds the bearer token to trading and auth API calls only', () => {
    http.get(`${environment.tradingApiUrl}/api/clients/12/balance`).subscribe();
    http.get('https://fonts.example.com/inter.css').subscribe();

    expect(backend.expectOne(`${environment.tradingApiUrl}/api/clients/12/balance`).request.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(backend.expectOne('https://fonts.example.com/inter.css').request.headers.has('Authorization')).toBe(false);
  });

  it('does not attach a stale token to the login call', () => {
    http.post(`${environment.authApiUrl}/auth/login`, {}).subscribe({ error: () => undefined });
    const request = backend.expectOne(`${environment.authApiUrl}/auth/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ statusCode: 401, message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.hasSession()).toBe(true);
  });

  it('ends the session when a platform API answers 401', () => {
    const logout = vi.spyOn(auth, 'logout');
    let status = 0;
    http.get(`${environment.tradingApiUrl}/instruments`).subscribe({ error: (error) => (status = error.status) });
    backend
      .expectOne(`${environment.tradingApiUrl}/instruments`)
      .flush({ status: 401, message: 'Invalid or expired token' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(logout).toHaveBeenCalledWith('expired');
    expect(auth.hasSession()).toBe(false);
  });

  it('leaves other errors to the caller', () => {
    const logout = vi.spyOn(auth, 'logout');
    http.get(`${environment.tradingApiUrl}/instruments`).subscribe({ error: () => undefined });
    backend.expectOne(`${environment.tradingApiUrl}/instruments`).flush({ message: 'nope' }, { status: 403, statusText: 'Forbidden' });
    expect(logout).not.toHaveBeenCalled();
    expect(auth.hasSession()).toBe(true);
  });
});
