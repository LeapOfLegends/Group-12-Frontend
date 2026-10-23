import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MetricsRange, PlatformMetrics } from '../../core/api/analytics-api.service';
import { PlatformMetricsComponent } from './platform-metrics';

const URL = `${environment.tradingApiUrl}/api/analytics/platform-metrics`;
const SUMMARY: PlatformMetrics = {
  range: 'all', from: null, to: '2026-10-23T12:00:00Z',
  totalOrders: 12, filledOrders: 7, pendingOrders: 2, failedRejectedOrders: 3,
  totalDeposits: 2750.25, totalWithdrawals: 350.5,
  tradingValues: [{ currency: 'USD', value: 1250.5 }, { currency: 'GBP', value: 500 }],
};

describe('Platform metrics', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlatformMetricsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function request(range: MetricsRange) {
    return http.expectOne((item) => item.url === URL && item.params.get('range') === range);
  }

  it('loads all-time metrics and displays separate currency totals', () => {
    const fixture = TestBed.createComponent(PlatformMetricsComponent);
    fixture.detectChanges();
    request('all').flush(SUMMARY);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Total orders');
    expect(element.textContent).toContain('12');
    expect(element.textContent).toContain('Trading value (USD)');
    expect(element.textContent).toContain('$1,250.50');
    expect(element.textContent).toContain('Trading value (GBP)');
    expect(element.textContent).toContain('£500.00');
    expect(element.querySelector('[aria-label="Total deposits $2,750.25"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Total withdrawals $350.50"]')).not.toBeNull();
  });

  it('requests each selected period and clears old values during loading', () => {
    const fixture = TestBed.createComponent(PlatformMetricsComponent);
    fixture.detectChanges();
    request('all').flush(SUMMARY);
    fixture.detectChanges();
    for (const range of ['week', 'month', 'year', 'all'] as const) {
      const input = (fixture.nativeElement as HTMLElement).querySelector(`input[value="${range}"]`) as HTMLInputElement;
      input.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('$1,250.50');
      request(range).flush({ ...SUMMARY, range, totalDeposits: 100, totalWithdrawals: 25 });
      fixture.detectChanges();
      expect(input.checked).toBe(true);
      expect(fixture.nativeElement.querySelector('[aria-label="Total deposits $100.00"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-label="Total withdrawals $25.00"]')).not.toBeNull();
    }
  });

  it('cancels obsolete requests when the period changes quickly', () => {
    const fixture = TestBed.createComponent(PlatformMetricsComponent);
    fixture.detectChanges();
    const oldRequest = request('all');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[value="week"]')!.click();
    fixture.detectChanges();
    expect(oldRequest.cancelled).toBe(true);
    request('week').flush({ ...SUMMARY, range: 'week' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('12');
  });

  it('shows failures without fabricated zeros and retries the selected period', () => {
    const fixture = TestBed.createComponent(PlatformMetricsComponent);
    fixture.detectChanges();
    request('all').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.querySelector('app-financial-summary-card')).toBeNull();
    element.querySelector<HTMLButtonElement>('.alert button')!.click();
    fixture.detectChanges();
    request('all').flush({ ...SUMMARY, totalOrders: 0, filledOrders: 0, pendingOrders: 0, failedRejectedOrders: 0, totalDeposits: 0, totalWithdrawals: 0, tradingValues: [] });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).toContain('No filled trades');
    expect(element.querySelector('[aria-label="Total deposits $0.00"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Total withdrawals $0.00"]')).not.toBeNull();
  });
});