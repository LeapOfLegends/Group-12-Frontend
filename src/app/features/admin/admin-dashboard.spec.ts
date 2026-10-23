import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { adminToken } from '../../testing/jwt-fixtures';
import { AdminDashboardPage } from './admin-dashboard';

const CLIENTS_URL = `${environment.tradingApiUrl}/api/clients`;
const CLIENTS = [
  { clientId: 12, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', accountBalance: '1250.50' },
  { clientId: 13, firstName: 'John', lastName: 'Smith', email: 'john@example.com', accountBalance: '0' },
];

describe('Finance admin dashboard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(InstrumentCatalogService), 'load').mockResolvedValue([]);
    TestBed.inject(AuthService).login({ email: 'finance@admin.com', password: 'test' }).subscribe();
    http.expectOne(`${environment.authApiUrl}/auth/login`).flush({
      accessToken: adminToken('finance', 62, 'finance@admin.com'),
      admin: { adminId: 62, firstName: 'Finance', lastName: 'Admin', email: 'finance@admin.com', role: 'finance' },
    });
  });

  afterEach(() => {
    http.verify();
    TestBed.inject(AuthService).clearSession();
    localStorage.clear();
  });

  it('shows the platform overview and client cash records without granting management access', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    http.expectOne(CLIENTS_URL).flush(CLIENTS);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#overview-title')?.textContent).toContain('Platform overview');
    const cards = Array.from(element.querySelectorAll('app-financial-summary-card'));
    expect(cards.find((card) => card.textContent?.includes('Registered clients'))?.textContent).toContain('2');
    expect(cards.find((card) => card.textContent?.includes('Accounts with cash'))?.textContent).toContain('1');
    expect(cards.find((card) => card.textContent?.includes('Total client cash'))).toBeDefined();
    const cash = element.querySelector('app-cash-positions');
    expect(cash?.querySelectorAll('tbody tr').length).toBe(2);
    expect(cash?.textContent).toContain('Jane Doe');
    expect(cash?.textContent).toContain('1,250.50');
    expect(element.querySelector('app-client-lookup')).toBeNull();
    expect(element.querySelector('app-admin-management')).toBeNull();
  });

  it('shows a failed cash load as an error and retries successfully', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    http.expectOne(CLIENTS_URL).flush({ message: 'Client records are unavailable.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    const cash = (fixture.nativeElement as HTMLElement).querySelector('app-cash-positions')!;

    expect(cash.querySelector('[role="alert"]')?.textContent).toContain('Client records are unavailable.');
    expect(cash.textContent).not.toContain('No clients match');
    expect(cash.textContent).not.toContain('total cash');
    (cash.querySelector('button.alert-action') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne(CLIENTS_URL).flush(CLIENTS);
    fixture.detectChanges();

    expect(cash.querySelector('[role="alert"]')).toBeNull();
    expect(cash.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('distinguishes an empty client list from a search with no matches', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    http.expectOne(CLIENTS_URL).flush([]);
    fixture.detectChanges();
    const cash = (fixture.nativeElement as HTMLElement).querySelector('app-cash-positions')!;

    expect(cash.textContent).toContain('No client cash positions');
    expect(cash.textContent).not.toContain('No clients match');
  });
});