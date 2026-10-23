import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { makeToken } from '../../testing/jwt-fixtures';
import { LoginPage } from './login';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

/** POST /auth/login answers, shaped like Group-12-Auth's. */
const CLIENT_LOGIN = {
  accessToken: makeToken({ sub: '12', email: 'jane@example.com', roles: ['CLIENT'], iat: 0, exp: FUTURE }),
  client: {
    clientId: '12',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phoneNumber: '',
    dateOfBirth: '',
    accountBalance: '0',
    createdAt: '',
  },
};
const ADMIN_LOGIN = {
  accessToken: makeToken({ sub: '60', email: 'super@admin.com', roles: 'SUPER_ADMIN', iat: 0, exp: FUTURE }),
  admin: {
    adminId: '60',
    firstName: 'Super',
    lastName: 'Admin',
    email: 'super@admin.com',
    role: 'super_admin',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
};

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let http: HttpTestingController;
  let router: Router;

  async function setup(queryParams: Record<string, string> = {}): Promise<void> {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await fixture.whenStable();
  }

  function element<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function type(selector: string, value: string): void {
    const input = element<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  /** Signs in with the given answer from Group-12-Auth and returns where the page navigated. */
  async function signIn(email: string, response: object): Promise<unknown> {
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    type('#login-email', email);
    type('#login-password', 'Password123!');
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectOne(`${environment.authApiUrl}/auth/login`).flush(response);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledTimes(1);
    return navigate.mock.calls[0][0];
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('shows validation messages and sends nothing when the form is empty', async () => {
    await setup();
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Enter your email address.');
    expect(fixture.nativeElement.textContent).toContain('Enter your password.');
    http.expectNone(`${environment.authApiUrl}/auth/login`);
  });

  it('explains a wrong password without revealing which field was wrong', async () => {
    await setup();
    type('#login-email', 'jane@example.com');
    type('#login-password', 'wrong');
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    http
      .expectOne(`${environment.authApiUrl}/auth/login`)
      .flush(
        { statusCode: 401, message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element('[role="alert"]').textContent).toContain('incorrect');
    expect(element<HTMLInputElement>('#login-password').value).toBe('');
  });

  it('navigates to the dashboard after a successful sign-in', async () => {
    await setup();
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    type('#login-email', 'jane@example.com');
    type('#login-password', 'ClientPassword123!');
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    http.expectOne(`${environment.authApiUrl}/auth/login`).flush({
      accessToken: makeToken({
        sub: '12',
        email: 'jane@example.com',
        roles: ['CLIENT'],
        iat: 0,
        exp: FUTURE,
      }),
      client: {
        clientId: '12',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phoneNumber: '',
        dateOfBirth: '',
        accountBalance: '0',
        createdAt: '',
      },
    });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('returns to a safe in-app URL after sign-in and ignores external ones', async () => {
    await setup({ returnUrl: 'https://evil.example/phish' });
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    type('#login-email', 'jane@example.com');
    type('#login-password', 'ClientPassword123!');
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectOne(`${environment.authApiUrl}/auth/login`).flush({
      accessToken: makeToken({
        sub: '12',
        email: 'jane@example.com',
        roles: ['CLIENT'],
        iat: 0,
        exp: FUTURE,
      }),
      client: {
        clientId: '12',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phoneNumber: '',
        dateOfBirth: '',
        accountBalance: '0',
        createdAt: '',
      },
    });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('sends an administrator to the admin dashboard after a successful sign-in', async () => {
    await setup();
    expect(await signIn('super@admin.com', ADMIN_LOGIN)).toBe('/admin');
  });

  it('sends an administrator to the admin dashboard even when sign-in started from /dashboard', async () => {
    await setup({ returnUrl: '/dashboard' });
    expect(await signIn('super@admin.com', ADMIN_LOGIN)).toBe('/admin');
  });

  it('returns an administrator to the admin page they asked for', async () => {
    await setup({ returnUrl: '/admin?section=admins' });
    expect(await signIn('super@admin.com', ADMIN_LOGIN)).toBe('/admin?section=admins');
  });

  it('returns a client to the client page they asked for', async () => {
    await setup({ returnUrl: '/trade' });
    expect(await signIn('jane@example.com', CLIENT_LOGIN)).toBe('/trade');
  });

  it('sends a client who started from /admin to their own dashboard', async () => {
    await setup({ returnUrl: '/admin' });
    expect(await signIn('jane@example.com', CLIENT_LOGIN)).toBe('/dashboard');
  });

  it('mentions an expired session when sent back by the interceptor', async () => {
    await setup({ reason: 'expired' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your session has expired');
  });
  it('offers account creation for new clients', async () => {
    await setup();
    fixture.detectChanges();
    const link = element<HTMLAnchorElement>('#create-account-link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/register');
    expect(link.textContent).toContain('Create Account');
  });

  it('welcomes a client who has just registered and prefills the email from navigation state', async () => {
    window.history.replaceState({ registeredEmail: 'nia@example.com' }, '');
    try {
      await setup({ registered: '1' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Your account has been created');
      expect(element<HTMLInputElement>('#login-email').value).toBe('nia@example.com');
    } finally {
      window.history.replaceState(null, '');
    }
  });

  it('explains when the sign-in service cannot be reached through the proxy', async () => {
    await setup();
    type('#login-email', 'jane@example.com');
    type('#login-password', 'ClientPassword123!');
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http
      .expectOne(`${environment.authApiUrl}/auth/login`)
      .flush('Error occurred while trying to proxy', {
        status: 504,
        statusText: 'Gateway Timeout',
      });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element('[role="alert"]').textContent).toContain(
      'Group-12-Auth is running on port 3000',
    );
  });
});
