import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Order } from '../../core/models/trading.models';
import { FUTURE_EXP, clientToken } from '../../testing/jwt-fixtures';
import { TradeConfirmationPage } from './trade-confirmation';

const API = environment.tradingApiUrl;

const INSTRUMENT = {
  instrumentId: 2,
  symbol: 'AAPL',
  instrumentName: 'Apple',
  assetClass: 'EQUITY',
  currency: 'USD',
  tradable: true,
  bidPrice: 339.94,
  askPrice: 340,
  lastPrice: 340,
  quoteAsOf: '2026-10-14T00:00:00Z',
  lastTradeAsOf: '2026-10-14T00:00:00Z',
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    orderId: 100,
    clientId: 12,
    instrumentId: 2,
    orderType: 'BUY',
    quantity: 2,
    status: 'ACCEPTED',
    reservedCash: 680,
    submittedAt: '2026-10-14T15:00:00Z',
    acceptedAt: '2026-10-14T15:00:01Z',
    rejectedAt: null,
    failedAt: null,
    filledAt: null,
    executionPrice: null,
    executionQuoteAsOf: null,
    tradeValue: null,
    rejectionReason: null,
    failureReason: null,
    ...overrides,
  };
}

const FILLED = order({
  status: 'FILLED',
  filledAt: '2026-10-14T15:00:05Z',
  executionPrice: 340,
  executionQuoteAsOf: '2026-10-14T15:00:04Z',
  tradeValue: 680,
  reservedCash: null,
});

function seedSession(): void {
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
}

describe('TradeConfirmationPage', () => {
  let http: HttpTestingController;
  let router: Router;

  async function setup(
    state: unknown,
    queryParams: Record<string, string> = {},
  ): Promise<ComponentFixture<TradeConfirmationPage>> {
    localStorage.clear();
    seedSession();
    window.history.replaceState(state, '');
    await TestBed.configureTestingModule({
      imports: [TradeConfirmationPage],
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
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TradeConfirmationPage);
    await fixture.whenStable();
    return fixture;
  }

  /** A settled order triggers a portfolio refresh; answer those reads with empty data. */
  function drainPortfolioRequests(): void {
    for (const request of http.match((candidate) =>
      /\/api\/(clients|client|orders\/client)\//.test(candidate.url),
    )) {
      request.flush(
        request.request.url.endsWith('/balance') ? { clientId: 12, accountBalance: 1000 } : [],
      );
    }
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
    window.history.replaceState(null, '');
  });

  it('shows a filled order from navigation state without re-fetching it', async () => {
    const fixture = await setup(
      { order: FILLED, instrument: INSTRUMENT, estimatedPrice: 340 },
      { orderId: '100' },
    );
    drainPortfolioRequests();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Trade executed');
    expect(text).toContain('Apple');
    expect(text).toContain('AAPL');
    expect(text).toContain('Buy');
    expect(text).toContain('Execution price');
    expect(text).toContain('$340.00');
    expect(text).toContain('Total transaction amount');
    expect(text).toContain('$680.00');
    expect(text).toContain('No commission');
    expect(text).toContain('ORD-100');
    expect(text).toContain('Filled');
    expect(text).toContain('Place Another Trade');
    expect(text).toContain('Return to Dashboard');
    http.expectNone(`${API}/api/clients/me/orders/100`);
  });

  it('shows an accepted order as pending and only reports execution once the backend does', async () => {
    const fixture = await setup(
      { order: order(), instrument: INSTRUMENT, estimatedPrice: 340 },
      { orderId: '100' },
    );
    fixture.detectChanges();
    let text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Order accepted');
    expect(text).toContain('Executing');
    expect(text).toContain('Pending execution');
    expect(text).toContain('Cash reserved');
    expect(text).not.toContain('Trade executed');

    // The page re-reads the order record on the configured interval.
    await new Promise((resolve) => setTimeout(resolve, environment.orderPollIntervalMs + 100));
    http.expectOne(`${API}/api/clients/me/orders/100`).flush(FILLED);
    await fixture.whenStable();
    drainPortfolioRequests();
    await fixture.whenStable();
    fixture.detectChanges();

    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Trade executed');
    expect(text).toContain('$680.00');
  }, 10000);

  it('reloads the order and its instrument from the backend on a deep link', async () => {
    const fixture = await setup(null, { orderId: '100' });
    http.expectOne(`${API}/api/clients/me/orders/100`).flush(FILLED);
    await fixture.whenStable();
    http.expectOne(`${API}/instruments/2`).flush({ ...INSTRUMENT, instrumentId: undefined });
    drainPortfolioRequests();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Trade executed');
    expect(text).toContain('AAPL');
  });

  it('refuses to show an order that belongs to another account', async () => {
    const fixture = await setup(
      { order: { ...FILLED, clientId: 99 }, instrument: INSTRUMENT, estimatedPrice: null },
      { orderId: '100' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('belongs to a different account');
    http.expectNone(`${API}/api/clients/me/balance`);
  });

  it('sends the client back to the trade page when there is nothing to confirm', async () => {
    await setup(null);
    expect(router.navigate).toHaveBeenCalledWith(['/trade']);
  });
});
