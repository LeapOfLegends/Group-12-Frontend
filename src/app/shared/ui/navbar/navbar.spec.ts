import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { FUTURE_EXP, adminToken, clientToken } from '../../../testing/jwt-fixtures';
import { NavbarComponent } from './navbar';

type SessionKind = 'client' | 'admin' | 'none';

function seedSession(kind: SessionKind): void {
  localStorage.clear();
  if (kind === 'none') {
    return;
  }
  const admin = kind === 'admin';
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: admin ? adminToken('operations', 61, 'ops@admin.com') : clientToken(),
      user: {
        kind,
        id: admin ? 61 : 12,
        email: admin ? 'ops@admin.com' : 'jane@example.com',
        firstName: admin ? 'Olivia' : 'Jane',
        lastName: admin ? 'Ops' : 'Doe',
        displayName: admin ? 'Olivia Ops' : 'Jane Doe',
        role: admin ? 'operations' : null,
        createdAt: null,
      },
      expiresAt: FUTURE_EXP * 1000,
      issuedAt: 0,
    }),
  );
}

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;

  async function setup(kind: SessionKind): Promise<void> {
    seedSession(kind);
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(NavbarComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  /** [href, label] of every link in the desktop navigation, in order. */
  function links(): [string | null, string][] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('nav.navbar-links a') as NodeListOf<HTMLAnchorElement>,
    ).map((anchor) => [anchor.getAttribute('href'), anchor.textContent?.trim() ?? '']);
  }

  afterEach(() => localStorage.clear());

  it('applies sticky positioning to the Angular host so page content can scroll beneath it', async () => {
    await setup('client');
    const host = fixture.nativeElement as HTMLElement;
    const styles = getComputedStyle(host);

    expect(styles.display).toBe('block');
    expect(styles.position).toBe('sticky');
    expect(styles.top).toBe('0px');
    expect(styles.zIndex).toBe('30');
    expect(getComputedStyle(element<HTMLElement>('.navbar')!).position).not.toBe('sticky');
  });

  it('offers Log in and Sign up, and no profile card, when nobody is signed in', async () => {
    await setup('none');
    expect(element('nav.navbar-links')).toBeNull();
    expect(element('.navbar-account')).toBeNull();
    expect(element<HTMLAnchorElement>('a.navbar-login')?.getAttribute('href')).toBe('/login');
    expect(element<HTMLAnchorElement>('a.navbar-signup')?.getAttribute('href')).toBe('/register');
    expect(element('app-brand-logo a')?.getAttribute('href')).toBe('/');
    expect(element('button[aria-label="Switch to dark theme"]')).not.toBeNull();
  });

  it('shows the client links on the left and the profile card on the right', async () => {
    await setup('client');
    expect(links()).toEqual([
      ['/dashboard', 'Dashboard'],
      ['/activity', 'Activity'],
      ['/transfer', 'Transfer Money'],
      ['/trade', 'Place Trade'],
    ]);
    expect(element('a[href="/admin"]')).toBeNull();
    expect(element('a.navbar-login')).toBeNull();
    const account = element('.navbar-account');
    expect(account?.textContent).toContain('Jane Doe');
    expect(account?.textContent).toContain('Client account');
    expect(element('.navbar-account .avatar')?.textContent?.trim()).toBe('JD');
    expect(element('app-brand-logo a')?.getAttribute('href')).toBe('/');
  });

  it('shows only the Admin Dashboard to administrators, without the client dashboard or money movement', async () => {
    await setup('admin');
    expect(links()).toEqual([['/admin', 'Admin Dashboard']]);
    expect(element('a[href="/dashboard"]')).toBeNull();
    expect(element('a[href="/transfer"]')).toBeNull();
    expect(element('a[href="/trade"]')).toBeNull();
    expect(element('a[href="/activity"]')).toBeNull();
    expect(element('.navbar-account')?.textContent).toContain('Operations Admin');
    expect(element('app-brand-logo a')?.getAttribute('href')).toBe('/');
  });

  it('asks the layout to open the profile panel from the profile card', async () => {
    await setup('client');
    const opened = vi.fn();
    fixture.componentInstance.openAccount.subscribe(opened);
    element<HTMLButtonElement>('.navbar-account')?.click();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('toggles the mobile menu, reports its state and closes it on Escape', async () => {
    await setup('client');
    const toggle = element<HTMLButtonElement>('button[aria-controls="navbar-drawer"]');
    const drawer = element('#navbar-drawer');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(drawer?.getAttribute('aria-hidden')).toBe('true');
    expect(drawer?.hasAttribute('inert')).toBe(true);

    toggle?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('Close navigation');
    expect(drawer?.getAttribute('aria-hidden')).toBe('false');
    expect(drawer?.hasAttribute('inert')).toBe(false);
    expect(drawer?.textContent).toContain('Place Trade');
    expect(drawer?.textContent).toContain('Activity');
    expect(drawer?.textContent).toContain('Log out');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });
});
