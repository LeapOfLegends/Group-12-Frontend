import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../services/notification.service';
import { makeToken } from '../../testing/jwt-fixtures';
import { adminGuard, authGuard, clientGuard, guestGuard } from './auth.guards';
import { AuthService } from './auth.service';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function seedSession(kind: 'client' | 'admin'): void {
  const token =
    kind === 'admin'
      ? makeToken({ sub: '60', email: 'ops@admin.com', roles: 'OPERATIONS', iat: 0, exp: FUTURE })
      : makeToken({ sub: '12', email: 'jane@example.com', roles: ['CLIENT'], iat: 0, exp: FUTURE });
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: token,
      user: { kind, id: kind === 'admin' ? 60 : 12, email: '', firstName: '', lastName: '', displayName: '', role: kind === 'admin' ? 'operations' : null, createdAt: null },
      expiresAt: FUTURE * 1000,
      issuedAt: 0,
    }),
  );
}

function run(guard: typeof authGuard, url = '/trade'): boolean | UrlTree {
  return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as boolean | UrlTree;
}

function urlOf(result: boolean | UrlTree): string {
  return result instanceof UrlTree ? result.toString() : String(result);
}

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => localStorage.clear());

  it('authGuard sends signed-out visitors to /login with a return URL', () => {
    TestBed.inject(AuthService);
    expect(urlOf(run(authGuard, '/trade'))).toBe('/login?returnUrl=%2Ftrade');
  });

  it('authGuard lets a signed-in user through', () => {
    seedSession('client');
    TestBed.inject(AuthService);
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard sends signed-in administrators to the admin dashboard', () => {
    seedSession('admin');
    TestBed.inject(AuthService);
    expect(urlOf(run(guestGuard, '/login'))).toBe('/admin');
  });

  it('guestGuard sends signed-in clients to their dashboard', () => {
    seedSession('client');
    TestBed.inject(AuthService);
    expect(urlOf(run(guestGuard, '/login'))).toBe('/dashboard');
  });

  it('guestGuard lets signed-out visitors through', () => {
    TestBed.inject(AuthService);
    expect(run(guestGuard, '/login')).toBe(true);
  });

  it('adminGuard blocks clients and explains why', () => {
    seedSession('client');
    TestBed.inject(AuthService);
    const warn = vi.spyOn(TestBed.inject(NotificationService), 'warning');
    expect(urlOf(run(adminGuard, '/admin'))).toBe('/dashboard');
    expect(warn).toHaveBeenCalled();
  });

  it('adminGuard admits administrators', () => {
    seedSession('admin');
    TestBed.inject(AuthService);
    expect(run(adminGuard, '/admin')).toBe(true);
  });

  it('clientGuard sends administrators back to the admin dashboard', () => {
    seedSession('admin');
    TestBed.inject(AuthService);
    const warn = vi.spyOn(TestBed.inject(NotificationService), 'warning');
    expect(urlOf(run(clientGuard, '/transfer'))).toBe('/admin');
    expect(urlOf(run(clientGuard, '/trade'))).toBe('/admin');
    expect(warn).toHaveBeenCalled();
  });

  it('clientGuard admits clients', () => {
    seedSession('client');
    TestBed.inject(AuthService);
    expect(run(clientGuard, '/transfer')).toBe(true);
  });
});
