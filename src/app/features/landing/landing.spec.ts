import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { FUTURE_EXP, clientToken } from '../../testing/jwt-fixtures';
import { LandingPage } from './landing';

describe('LandingPage', () => {
  let fixture: ComponentFixture<LandingPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  function element<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  it('introduces the platform under the public navbar with sign-up and log-in calls to action', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Trade directly. See every position. Know every outcome.');
    expect(text).toContain('What you can do');
    expect(text).toContain('How it works');
    expect(text).toContain('Look up any price');

    expect(element('app-navbar a[href="/login"]')).not.toBeNull();
    expect(element('app-navbar a[href="/register"]')).not.toBeNull();
    expect(element('app-navbar .navbar-account')).toBeNull();
    expect(element('app-navbar nav.navbar-links')).toBeNull();

    expect(element('#landing-signup')?.getAttribute('href')).toBe('/register');
    expect(element('#landing-login')?.getAttribute('href')).toBe('/login');
    expect(element('app-brand-logo a')?.getAttribute('href')).toBe('/');
  });

  it('invents no figures: no amounts, percentages or statistics appear on the page', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toMatch(/\$\s?[\d,]+/);
    expect(text).not.toMatch(/\d+(\.\d+)?\s?%/);
  });

  it('lets a signed-in user open their account panel and log out from the landing page', async () => {
    localStorage.setItem(
      environment.sessionStorageKey,
      JSON.stringify({
        accessToken: clientToken(),
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
        expiresAt: FUTURE_EXP * 1000,
        issuedAt: 0,
      }),
    );
    fixture.destroy();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element('app-navbar .navbar-account')?.textContent).toContain('Jane Doe');
    expect(element('#landing-dashboard')?.getAttribute('href')).toBe('/dashboard');
    expect(element('#landing-dashboard')?.textContent).toContain('Go to dashboard');
    expect(element('#landing-signup')).toBeNull();
    expect(element('#landing-login')).toBeNull();
    expect(element('.cta-actions')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('a[href="/register"], a[href="/login"]').length).toBe(0);
    element<HTMLButtonElement>('app-navbar .navbar-account')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element('app-account-panel dialog')?.hasAttribute('open')).toBe(true);
    expect(element('app-account-panel')?.textContent).toContain('Log out');
    const dialog = element<HTMLDialogElement>('app-account-panel dialog');
    Object.defineProperty(dialog, 'close', {
      value: () => dialog?.removeAttribute('open'),
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    element<HTMLButtonElement>('app-account-panel button.btn-primary')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element('app-navbar .navbar-account')).toBeNull();
    expect(element('app-navbar a.navbar-login')).not.toBeNull();
  });
});
