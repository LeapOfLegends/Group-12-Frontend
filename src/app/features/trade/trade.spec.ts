import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogInstrument, MarketAvailability } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { TradePage } from './trade';

const INSTRUMENT: CatalogInstrument = {
  instrumentId: 2, symbol: 'AAPL', instrumentName: 'Apple', assetClass: 'EQUITY',
  currency: 'USD', tradable: true, bidPrice: 99, askPrice: 100, lastPrice: 100,
  quoteAsOf: new Date().toISOString(), lastTradeAsOf: null,
};
const statusUrl = (id = 2) => `${environment.tradingApiUrl}/instruments/${id}/market-status`;
function availability(status: 'OPEN' | 'CLOSED' = 'OPEN'): MarketAvailability {
  return {
    marketCode: 'IEX', status, tradingAllowed: status === 'OPEN',
    message: status === 'OPEN' ? 'IEX market is open.' : 'IEX market is closed. Please try again when it reopens.',
    statusAsOf: new Date().toISOString(), validUntil: new Date(Date.now() + 90000).toISOString(),
    rejectionReason: status === 'OPEN' ? null : 'MARKET_CLOSED',
  };
}

describe('TradePage market availability', () => {
  let fixture: ComponentFixture<TradePage>;
  let page: TradePage;
  let http: HttpTestingController;
  const submit = vi.fn();

  beforeEach(async () => {
    submit.mockReset();
    await TestBed.configureTestingModule({
      imports: [TradePage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: AuthService, useValue: { user: signal({ id: 12 }) } },
        { provide: OrdersApiService, useValue: { submit } },
        { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn() } },
        { provide: InstrumentCatalogService, useValue: {
          loading: signal(false), error: signal(null), instruments: signal([INSTRUMENT]),
          load: vi.fn().mockResolvedValue([INSTRUMENT]),
        } },
        { provide: PortfolioService, useValue: {
          load: vi.fn().mockResolvedValue(undefined), refresh: vi.fn().mockResolvedValue(undefined),
          summary: signal({ buyingPower: 10000 }), sellableQuantity: () => 5,
        } },
      ],
    }).compileComponents();
    vi.useFakeTimers();
    fixture = TestBed.createComponent(TradePage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    page['choose'](INSTRUMENT);
    page['quantityText'].set('1');
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  function flushStatus(status: 'OPEN' | 'CLOSED' = 'OPEN'): void {
    http.expectOne(statusUrl()).flush(availability(status));
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    return [...fixture.nativeElement.querySelectorAll('button')]
      .find((element: HTMLButtonElement) => element.textContent?.includes(label));
  }

  it('blocks review and direct submission while availability is loading', () => {
    fixture.detectChanges();
    expect(button('Review order').disabled).toBe(true);
    page['confirmOrder']();
    expect(submit).not.toHaveBeenCalled();
    flushStatus();
  });

  it('shows closure and blocks both buy and sell orders', () => {
    flushStatus('CLOSED');
    expect(fixture.nativeElement.textContent).toContain('Market closed');
    for (const side of ['BUY', 'SELL'] as const) {
      page['setSide'](side);
      page['reviewOrder']();
      page['confirmOrder']();
      expect(page['step']()).toBe('entry');
    }
    expect(button('Review order').disabled).toBe(true);
    expect(submit).not.toHaveBeenCalled();
  });

  it('enables review when the backend reports an open market', () => {
    flushStatus();
    expect(button('Review order').disabled).toBe(false);
    page['reviewOrder']();
    fixture.detectChanges();
    expect(button('Place buy order').disabled).toBe(false);
  });

  it('disables confirmation and explains closure if the market closes during review', async () => {
    flushStatus();
    page['reviewOrder']();
    await vi.advanceTimersByTimeAsync(15000);
    flushStatus('CLOSED');
    expect(button('Place buy order').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('IEX market is closed');
    page['confirmOrder']();
    expect(submit).not.toHaveBeenCalled();
  });

  it('fails closed on status request failure and recovers on the next poll', async () => {
    http.expectOne(statusUrl()).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(button('Review order').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Market status could not be checked');
    await vi.advanceTimersByTimeAsync(15000);
    flushStatus();
    expect(button('Review order').disabled).toBe(false);
  });

  it('cancels a previous instrument request when selection changes', async () => {
    const old = http.expectOne(statusUrl());
    page['choose']({ ...INSTRUMENT, instrumentId: 3, symbol: 'MSFT' });
    expect(old.cancelled).toBe(true);
    expect(page['marketTradingAllowed']()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne(statusUrl(3)).flush(availability('CLOSED'));
    expect(page['marketTradingAllowed']()).toBe(false);
  });

  it('blocks confirmation when backend availability expires between polls', async () => {
    http.expectOne(statusUrl()).flush({ ...availability(), validUntil: new Date(Date.now() + 1000).toISOString() });
    page['reviewOrder']();
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(button('Place buy order').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Market status has expired');
    page['confirmOrder']();
    expect(submit).not.toHaveBeenCalled();
  });
});