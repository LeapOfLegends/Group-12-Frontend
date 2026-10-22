import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
