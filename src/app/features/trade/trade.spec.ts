import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  CatalogInstrument,
  InstrumentHistory,
  MarketAvailability,
  Order,
} from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { TradePage } from './trade';

const INSTRUMENT: CatalogInstrument = {
  instrumentId: 2,
  symbol: 'AAPL',
  instrumentName: 'Apple',
  assetClass: 'EQUITY',
  currency: 'USD',
  tradable: true,
  bidPrice: 99,
  askPrice: 100,
  lastPrice: 100,
  quoteAsOf: new Date().toISOString(),
  lastTradeAsOf: null,
};
const statusUrl = (id = 2) => `${environment.tradingApiUrl}/instruments/${id}/market-status`;
const historyUrl = (id = 2, range = '1D') =>
  `${environment.tradingApiUrl}/instruments/${id}/history?range=${range}`;
function history(
  instrument = INSTRUMENT,
  range: InstrumentHistory['range'] = '1D',
): InstrumentHistory {
  return {
    instrumentId: instrument.instrumentId,
    symbol: instrument.symbol,
    range,
    timeframe: range === '1D' ? '5Min' : '30Min',
    currency: instrument.currency,
    availableFrom: '2026-10-23T14:30:00Z',
    availableTo: '2026-10-23T14:35:00Z',
    partial: false,
    points: [
      { timestamp: '2026-10-23T14:30:00Z', close: 99.5 },
      { timestamp: '2026-10-23T14:35:00Z', close: 100 },
    ],
  };
}
function availability(status: 'OPEN' | 'CLOSED' = 'OPEN'): MarketAvailability {
  return {
    marketCode: 'IEX',
    status,
    tradingAllowed: status === 'OPEN',
    message:
      status === 'OPEN'
        ? 'IEX market is open.'
        : 'IEX market is closed. Please try again when it reopens.',
    statusAsOf: new Date().toISOString(),
    validUntil: new Date(Date.now() + 90000).toISOString(),
    rejectionReason: status === 'OPEN' ? null : 'MARKET_CLOSED',
  };
}

describe('TradePage market availability', () => {
  let fixture: ComponentFixture<TradePage>;
  let page: TradePage;
  let http: HttpTestingController;
  const submit = vi.fn();
  const catalogInstruments = signal([INSTRUMENT]);

  beforeEach(async () => {
    submit.mockReset();
    catalogInstruments.set([INSTRUMENT]);
    await TestBed.configureTestingModule({
      imports: [TradePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: AuthService, useValue: { user: signal({ id: 12 }) } },
        { provide: OrdersApiService, useValue: { submit } },
        { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn() } },
        {
          provide: InstrumentCatalogService,
          useValue: {
            loading: signal(false),
            error: signal(null),
            instruments: catalogInstruments,
            load: vi.fn().mockResolvedValue([INSTRUMENT]),
          },
        },
        {
          provide: PortfolioService,
          useValue: {
            load: vi.fn().mockResolvedValue(undefined),
            refresh: vi.fn().mockResolvedValue(undefined),
            summary: signal({ buyingPower: 10000 }),
            sellableQuantity: () => 5,
          },
        },
      ],
    }).compileComponents();
    vi.useFakeTimers();
    fixture = TestBed.createComponent(TradePage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    page['choose'](INSTRUMENT);
    page['quantityText'].set('1');
    fixture.detectChanges();
    http.expectOne(historyUrl()).flush(history());
    fixture.detectChanges();
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
    return [...fixture.nativeElement.querySelectorAll('button')].find(
      (element: HTMLButtonElement) => element.textContent?.includes(label),
    );
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
    expect(fixture.nativeElement.textContent).toContain('IEX market is closed');
    for (const side of ['BUY', 'SELL'] as const) {
      page['setSide'](side);
      page['reviewOrder']();
      page['confirmOrder']();
      expect(page['step']()).toBe('entry');
    }
    expect(button('Review order').disabled).toBe(true);
    expect(submit).not.toHaveBeenCalled();
  });

  it('replaces the stale-quote warning with market closure in the summary before quantity entry', () => {
    catalogInstruments.set([
      { ...INSTRUMENT, quoteAsOf: new Date(Date.now() - 5280000).toISOString() },
    ]);
    page['quantityText'].set('');
    flushStatus('CLOSED');

    const summary = fixture.nativeElement.querySelector('app-order-summary');
    const warnings = summary.querySelectorAll('.alert-warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0].textContent).toContain('IEX market is closed');
    expect(summary.textContent).not.toContain('The quote for AAPL');
    expect(fixture.nativeElement.querySelector('.trade-entry .alert-warning')).toBeNull();
    expect(button('Review order').disabled).toBe(true);
  });

  it('keeps the stale-quote warning when the market is open', () => {
    catalogInstruments.set([
      { ...INSTRUMENT, quoteAsOf: new Date(Date.now() - 5280000).toISOString() },
    ]);
    flushStatus();
    const summary = fixture.nativeElement.querySelector('app-order-summary');
    expect(summary.querySelector('.alert-warning').textContent).toContain('The quote for AAPL');
    expect(button('Review order').disabled).toBe(false);
  });

  it('enables review when the backend reports an open market', () => {
    flushStatus();
    expect(button('Review order').disabled).toBe(false);
    page['reviewOrder']();
    fixture.detectChanges();
    expect(button('Place buy order').disabled).toBe(false);
  });

  it('uses the standardized order ID in rejected results and notifications', () => {
    const rejected: Order = {
      orderId: 47,
      clientId: 12,
      instrumentId: 2,
      orderType: 'BUY',
      quantity: 1,
      status: 'REJECTED',
      reservedCash: null,
      submittedAt: '2026-10-24T14:00:00Z',
      acceptedAt: null,
      rejectedAt: '2026-10-24T14:00:01Z',
      failedAt: null,
      filledAt: null,
      executionPrice: null,
      executionQuoteAsOf: null,
      tradeValue: null,
      rejectionReason: 'INSUFFICIENT_FUNDS',
      failureReason: null,
    };
    submit.mockReturnValue(of(rejected));
    flushStatus();

    page['reviewOrder']();
    page['confirmOrder']();
    fixture.detectChanges();

    const notifications = TestBed.inject(NotificationService);
    expect(notifications.warning).toHaveBeenCalledWith(expect.any(String), 'Order ORD-47 rejected');
    expect(fixture.nativeElement.textContent).toContain('Order ORD-47');
  });

  it('keeps the selected instrument attached to canonical catalogue updates', () => {
    flushStatus();
    catalogInstruments.set([{ ...INSTRUMENT, lastPrice: 110, bidPrice: 109, askPrice: 111 }]);
    expect(page['selected']()?.lastPrice).toBe(110);
    expect(page['estimatedPrice']()).toBe(111);
  });

  it('shows three quote prices and the embedded 1D chart without legacy controls', () => {
    flushStatus();
    const card = fixture.nativeElement.querySelector('.instrument-card') as HTMLElement;
    expect(card.textContent).toContain('Bid');
    expect(card.textContent).toContain('Ask');
    expect(card.textContent).toContain('Last trade');
    expect(card.textContent).not.toContain('Quote age');
    expect(card.querySelector('app-line-chart')).not.toBeNull();
    expect(card.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe('1D');
    expect(card.querySelector('a')).toBeNull();
  });

  it('shows one execution-price disclosure during entry and review', () => {
    flushStatus();
    const disclosure = () =>
      fixture.nativeElement.querySelectorAll('[aria-label="Execution price information"]');
    expect(disclosure()).toHaveLength(1);
    expect(disclosure()[0].textContent).toContain('Market price may change');
    expect(disclosure()[0].textContent).toContain('not guaranteed');

    page['reviewOrder']();
    fixture.detectChanges();
    expect(disclosure()).toHaveLength(1);
  });

  it('requests a newly selected range from the embedded chart', () => {
    flushStatus();
    button('5D').click();
    fixture.detectChanges();
    http.expectOne(historyUrl(2, '5D')).flush(history(INSTRUMENT, '5D'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-pressed="true"]')?.textContent.trim()).toBe(
      '5D',
    );
  });

  it('shows slash-containing crypto history in the trade page using its numeric ID', async () => {
    flushStatus();
    const bitcoin: CatalogInstrument = {
      ...INSTRUMENT,
      instrumentId: 73,
      symbol: 'BTC/USD',
      instrumentName: 'Bitcoin',
      assetClass: 'CRYPTO',
    };
    catalogInstruments.set([INSTRUMENT, bitcoin]);
    page['choose'](bitcoin);
    fixture.detectChanges();
    http.expectOne(historyUrl(73)).flush(history(bitcoin));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne(statusUrl(73)).flush({ ...availability(), marketCode: 'CRYPTO' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-line-chart')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Times shown in Coordinated Universal Time (UTC).',
    );
    http.expectNone((request) => request.url.includes('BTC%2FUSD'));
  });

  it('cancels chart requests on instrument changes and clearing', () => {
    flushStatus();
    const microsoft: CatalogInstrument = {
      ...INSTRUMENT,
      instrumentId: 3,
      symbol: 'MSFT',
      instrumentName: 'Microsoft',
    };
    catalogInstruments.set([INSTRUMENT, microsoft]);

    page['choose'](microsoft);
    fixture.detectChanges();
    const microsoftHistory = http.expectOne(historyUrl(3));
    page['choose'](INSTRUMENT);
    fixture.detectChanges();
    expect(microsoftHistory.cancelled).toBe(true);

    const appleHistory = http.expectOne(historyUrl());
    page['clearInstrument']();
    fixture.detectChanges();
    expect(appleHistory.cancelled).toBe(true);
    expect(fixture.nativeElement.querySelector('app-instrument-history-chart')).toBeNull();
  });

  it('keeps trading available when history is unsupported', async () => {
    flushStatus();
    const option: CatalogInstrument = {
      ...INSTRUMENT,
      instrumentId: 9,
      symbol: 'AAPL-CALL',
      instrumentName: 'Apple Call Option',
      assetClass: 'OPTION',
    };
    catalogInstruments.set([INSTRUMENT, option]);
    page['choose'](option);
    fixture.detectChanges();
    http.expectNone(historyUrl(9));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne(statusUrl(9)).flush(availability());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Price history is not available for this instrument type',
    );
    expect(button('Review order').disabled).toBe(false);
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
    http
      .expectOne(statusUrl())
      .flush({ ...availability(), validUntil: new Date(Date.now() + 1000).toISOString() });
    page['reviewOrder']();
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(button('Place buy order').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Market status has expired');
    page['confirmOrder']();
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('TradePage query-parameter selection', () => {
  it('automatically selects a valid symbol from the URL', async () => {
    const catalogInstruments = signal([INSTRUMENT]);
    await TestBed.configureTestingModule({
      imports: [TradePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ symbol: 'aapl' }) },
          },
        },
        { provide: AuthService, useValue: { user: signal({ id: 12 }) } },
        { provide: OrdersApiService, useValue: { submit: vi.fn() } },
        { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn() } },
        {
          provide: InstrumentCatalogService,
          useValue: {
            loading: signal(false),
            error: signal(null),
            instruments: catalogInstruments,
            load: vi.fn().mockResolvedValue([INSTRUMENT]),
          },
        },
        {
          provide: PortfolioService,
          useValue: {
            load: vi.fn().mockResolvedValue(undefined),
            refresh: vi.fn().mockResolvedValue(undefined),
            summary: signal({ buyingPower: 10000 }),
            sellableQuantity: () => 5,
          },
        },
      ],
    }).compileComponents();
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TradePage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(fixture.componentInstance['selected']()?.symbol).toBe('AAPL');
    expect(fixture.componentInstance['query']()).toBe('AAPL');

    http.expectOne(historyUrl()).flush(history());
    http.expectOne(statusUrl()).flush(availability());
    fixture.destroy();
    http.verify({ ignoreCancelled: true });
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });
});
