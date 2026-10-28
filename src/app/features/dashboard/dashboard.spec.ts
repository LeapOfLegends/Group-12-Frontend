import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { makeToken } from '../../testing/jwt-fixtures';
import { DashboardPage } from './dashboard';
import { DEFAULT_WIDGET_ORDER, layoutStorageKey, serializeWidgetOrder } from './dashboard-layout';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const API = environment.tradingApiUrl;
const HISTORY_API = `${API}/api/clients/me/portfolio/history`;

function portfolioHistory(range = '1M', points: unknown[] = []): Record<string, unknown> {
  return {
    range,
    timeframe: range === '1D' ? '5Min' : '1Day',
    currency: 'USD',
    availableFrom: points.length ? '2026-10-01T00:00:00Z' : null,
    availableTo: points.length ? '2026-10-26T00:00:00Z' : null,
    partial: false,
    returnMethod: 'TWR',
    unavailablePointCount: 0,
    limitations: [],
    points,
  };
}

function seedSession(kind: 'client' | 'admin'): void {
  const token =
    kind === 'admin'
      ? makeToken({ sub: '60', email: 'super@admin.com', role: 'super_admin', iat: 0, exp: FUTURE })
      : makeToken({ sub: '12', email: 'jane@example.com', roles: ['CLIENT'], iat: 0, exp: FUTURE });
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: token,
      user: {
        kind,
        id: kind === 'admin' ? 60 : 12,
        email: '',
        firstName: kind === 'admin' ? 'Super' : 'Jane',
        lastName: kind === 'admin' ? 'Admin' : 'Doe',
        displayName: '',
        role: kind === 'admin' ? 'super_admin' : null,
        createdAt: null,
      },
      expiresAt: FUTURE * 1000,
      issuedAt: 0,
    }),
  );
}

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let http: HttpTestingController;

  /** `prepare` runs after storage is cleared and the session seeded, before the page is created. */
  async function setup(kind: 'client' | 'admin', prepare?: () => void): Promise<void> {
    localStorage.clear();
    seedSession(kind);
    prepare?.();
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
  }

  async function flushPortfolio(options: {
    readonly price: number | null;
    readonly averageCost?: number;
    readonly cash?: number;
  }): Promise<void> {
    http
      .expectOne(`${API}/api/clients/me/balance`)
      .flush({ clientId: 12, accountBalance: options.cash ?? 1000 });
    http.expectOne(`${API}/api/clients/me/holdings`).flush([
      {
        holdingId: 1,
        clientId: 12,
        instrumentId: 2,
        quantity: 10,
        averageCost: options.averageCost ?? 100,
        updatedAt: null,
      },
    ]);
    http.expectOne(`${API}/api/clients/me/orders`).flush([]);
    http.expectOne(`${API}/api/clients/me/transactions`).flush([]);
    http.expectOne(`${HISTORY_API}?range=1D`).flush(portfolioHistory('1D'));
    await fixture.whenStable();
    http.expectOne(`${API}/instruments/2`).flush({
      symbol: 'AAPL',
      instrumentName: 'Apple',
      assetClass: 'EQUITY',
      currency: 'USD',
      tradable: true,
      bidPrice: options.price,
      askPrice: options.price,
      lastPrice: options.price,
      quoteAsOf: '2026-10-13T00:00:00Z',
      lastTradeAsOf: '2026-10-13T00:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function portfolioCard(): HTMLElement {
    const card = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'app-financial-summary-card',
      ),
    ].find((candidate) => candidate.textContent?.includes('Holdings value'));
    if (!card) throw new Error('Holdings value card was not rendered');
    return card;
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads cash, holdings and orders for a client and derives the summary figures', async () => {
    await setup('client');

    http.expectOne(`${API}/api/clients/me/balance`).flush({ clientId: 12, accountBalance: 1000 });
    http.expectOne(`${API}/api/clients/me/holdings`).flush([
      {
        holdingId: 1,
        clientId: 12,
        instrumentId: 2,
        quantity: 10,
        averageCost: 100,
        updatedAt: null,
      },
    ]);
    http.expectOne(`${API}/api/clients/me/orders`).flush([
      {
        orderId: 9,
        clientId: 12,
        instrumentId: 2,
        orderType: 'BUY',
        quantity: 10,
        status: 'FILLED',
        reservedCash: null,
        submittedAt: '2026-10-01T10:00:00Z',
        acceptedAt: '2026-10-01T10:00:01Z',
        rejectedAt: null,
        failedAt: null,
        filledAt: '2026-10-01T10:00:05Z',
        executionPrice: 100,
        executionQuoteAsOf: '2026-10-01T10:00:04Z',
        tradeValue: 1000,
        rejectionReason: null,
        failureReason: null,
      },
    ]);
    http.expectOne(`${API}/api/clients/me/transactions`).flush([
      {
        transactionId: 3,
        clientId: 12,
        orderId: null,
        transactionType: 'DEPOSIT',
        amount: 500,
        balanceAfter: 1000,
        createdAt: '2026-10-02T10:00:00Z',
      },
      {
        transactionId: 2,
        clientId: 12,
        orderId: null,
        transactionType: 'WITHDRAWAL',
        amount: -50,
        balanceAfter: 500,
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        transactionId: 4,
        clientId: 12,
        orderId: 9,
        transactionType: 'BUY',
        amount: -1000,
        balanceAfter: 0,
        createdAt: '2026-10-01T10:00:05Z',
      },
      {
        transactionId: 5,
        clientId: 12,
        orderId: 10,
        transactionType: 'SELL',
        amount: 120,
        balanceAfter: 120,
        createdAt: '2026-10-03T10:00:00Z',
      },
    ]);
    http.expectOne(`${HISTORY_API}?range=1D`).flush(
      portfolioHistory('1D', [
        {
          timestamp: '2026-10-01T00:00:00Z',
          cashValue: 1000,
          holdingsValue: 1000,
          totalValue: 2000,
          cumulativeReturnPercent: 0,
          valuationStatus: 'COMPLETE',
        },
        {
          timestamp: '2026-10-26T00:00:00Z',
          cashValue: 1000,
          holdingsValue: 1200,
          totalValue: 2200,
          cumulativeReturnPercent: 6.67,
          valuationStatus: 'COMPLETE',
        },
      ]),
    );
    await fixture.whenStable();
    http.expectOne(`${API}/instruments/2`).flush({
      symbol: 'AAPL',
      instrumentName: 'Apple',
      assetClass: 'EQUITY',
      currency: 'USD',
      tradable: true,
      bidPrice: 119,
      askPrice: 121,
      lastPrice: 120,
      quoteAsOf: '2026-10-13T00:00:00Z',
      lastTradeAsOf: '2026-10-13T00:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Good');
    expect(text).toContain('$1,000.00'); // cash
    expect(text).toContain('$1,200.00'); // holdings value: 10 x 120
    expect(text).toContain('+$200.00'); // return vs 1,000 cost basis
    expect(text).toContain('+20.00%');
    expect(text).toContain('$2,200.00'); // total account value
    expect(text).not.toContain('Unrealized P/L');
    expect(text).toContain('+6.67%');
    expect(text).toContain('-$250.00');
    const valueCard = portfolioCard();
    expect(valueCard.querySelector('.summary-value')?.textContent).toContain('$1,200.00');
    expect(valueCard.querySelector('.summary-delta')?.textContent).toContain('+20.00% (+$200.00)');
    expect(valueCard.querySelector('.summary-delta-label')?.textContent).toContain('Total return');
    expect(valueCard.querySelector('.delta')?.classList.contains('delta-up')).toBe(true);
    expect(text).toContain('AAPL');
    expect(text).toContain('Filled');
    expect(text).toContain('Recent transactions');
    expect(text).toContain('Deposit');
    expect(text).toContain('Withdrawal');
    expect(text).toContain('+$500.00');
    expect(text).toContain('-$50.00');
    const transactions = fixture.nativeElement.querySelector(
      'app-transactions-table',
    ) as HTMLElement;
    expect(transactions.textContent).toContain('Buy');
    expect(transactions.textContent).toContain('Sell');
    expect(transactions.textContent).toContain('TXN-3');
    expect(transactions.textContent).toContain('TXN-2');
    expect(transactions.textContent).toContain('TXN-4');
    expect(transactions.textContent).toContain('TXN-5');
    expect(transactions.textContent).toContain('ORD-9');
    expect(transactions.textContent).toContain('ORD-10');
    expect(transactions.textContent).toContain('-$1,000.00');
    expect(transactions.textContent).toContain('+$120.00');
    expect(text).toContain('Buying Power & Asset Allocation');
    expect(text).toContain('Buying power');
    expect(text).toContain('Asset allocation');
    expect(text).toContain('Equity'); // allocation by asset class
    expect(text).not.toContain('Quick actions');
    expect(text).toContain('Transfer Money');
    expect(text).toContain('Place Trade');
    expect(
      fixture.nativeElement.querySelector('a[href="/activity?tab=orders"]')?.textContent,
    ).toContain('View all');
    expect(
      fixture.nativeElement.querySelector('a[href="/activity?tab=transactions"]')?.textContent,
    ).toContain('View all');
    expect(fixture.nativeElement.querySelector('a[href="/transfer"]')).not.toBeNull();
    expect(text).not.toContain('New Trade');
    // The price search sits in the header above the date, and is idle until used.
    const header = fixture.nativeElement.querySelector('.page-header .page-title') as HTMLElement;
    expect(header.firstElementChild?.tagName.toLowerCase()).toBe('app-instrument-search');
    http.expectNone(`${API}/instruments`);
  });

  it.each([
    { label: 'negative', price: 80, expected: '-20.00% (-$200.00)', tone: 'delta-down' },
    { label: 'zero', price: 100, expected: '0.00% ($0.00)', tone: 'delta-flat' },
  ])(
    'displays a $label total return beneath portfolio value',
    async ({ price, expected, tone }) => {
      await setup('client');
      await flushPortfolio({ price });

      const card = portfolioCard();
      expect(card.querySelector('.summary-value')?.nextElementSibling?.classList).toContain(
        'summary-delta',
      );
      expect(card.querySelector('.summary-delta')?.textContent).toContain(expected);
      expect(card.querySelector('.delta')?.classList.contains(tone)).toBe(true);
    },
  );

  it.each([
    { label: 'missing cost basis', price: 100, averageCost: 0 },
    { label: 'an unpriced holding', price: null, averageCost: 100 },
  ])('uses a neutral unavailable return for $label', async ({ price, averageCost }) => {
    await setup('client');
    await flushPortfolio({ price, averageCost });

    const card = portfolioCard();
    expect(card.querySelector('.summary-delta')?.textContent).toContain('Unavailable');
    expect(card.querySelector('.summary-delta')?.textContent).not.toContain('%');
    expect(card.querySelector('.delta')?.classList.contains('delta-flat')).toBe(true);
  });

  it('reacts when the shared instrument catalog receives a newer stored price', async () => {
    await setup('client');
    await flushPortfolio({ price: 120 });
    expect(portfolioCard().querySelector('.summary-delta')?.textContent).toContain(
      '+20.00% (+$200.00)',
    );

    const catalog = TestBed.inject(InstrumentCatalogService);
    const update = catalog.load(true);
    http.expectOne(`${API}/instruments`).flush([
      {
        instrumentId: 2,
        symbol: 'AAPL',
        instrumentName: 'Apple',
        assetClass: 'EQUITY',
        currency: 'USD',
        tradable: true,
        bidPrice: 79,
        askPrice: 81,
        lastPrice: 80,
        quoteAsOf: '2026-10-14T00:00:00Z',
        lastTradeAsOf: '2026-10-14T00:00:00Z',
      },
    ]);
    await update;
    fixture.detectChanges();

    const card = portfolioCard();
    expect(card.querySelector('.summary-value')?.textContent).toContain('$800.00');
    expect(card.querySelector('.summary-delta')?.textContent).toContain('-20.00% (-$200.00)');
    expect(card.querySelector('.delta')?.classList.contains('delta-down')).toBe(true);
  });

  describe('widget layout', () => {
    const layoutKey = layoutStorageKey(12);
    const reversed = [...DEFAULT_WIDGET_ORDER].reverse();
    const element = () => fixture.nativeElement as HTMLElement;
    const button = (id: string) => element().querySelector<HTMLButtonElement>(`#${id}`);
    const widgetOrder = () =>
      Array.from(element().querySelectorAll('.dashboard-widgets .grid-stack-item')).map((item) =>
        item.getAttribute('gs-id'),
      );

    function flushEmptyPortfolio(): void {
      http.expectOne(`${API}/api/clients/me/balance`).flush({ clientId: 12, accountBalance: 0 });
      http.expectOne(`${API}/api/clients/me/holdings`).flush([]);
      http.expectOne(`${API}/api/clients/me/orders`).flush([]);
      http.expectOne(`${API}/api/clients/me/transactions`).flush([]);
      http.expectOne(`${HISTORY_API}?range=1D`).flush(portfolioHistory('1D'));
    }

    async function render(prepare?: () => void): Promise<void> {
      await setup('client', prepare);
      flushEmptyPortfolio();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    async function click(id: string): Promise<void> {
      button(id)?.click();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('renders the seven widgets in the default order inside a live grid, locked', async () => {
      await render();
      expect(widgetOrder()).toEqual([...DEFAULT_WIDGET_ORDER]);
      expect(element().querySelector('.dashboard-widgets')?.classList.contains('grid-stack')).toBe(
        true,
      );
      expect(button('dashboard-edit-widgets')?.textContent?.trim()).toBe('Edit widgets');
      expect(button('dashboard-reset-layout')).toBeNull();
      expect(element().querySelector('.dashboard-edit-hint')).toBeNull();
      expect(
        element().querySelector('.grid-stack-item')?.classList.contains('ui-draggable-disabled'),
      ).toBe(true);
    });

    it('edit mode shows Done, Reset layout and a hint, unlocks dragging, and Done saves the order', async () => {
      await render();
      await click('dashboard-edit-widgets');
      const item = element().querySelector('.grid-stack-item[gs-id="cash"]') as HTMLElement & {
        ddElement?: { ddDraggable?: unknown };
      };
      expect(button('dashboard-edit-widgets')?.textContent?.trim()).toBe('Done');
      expect(button('dashboard-reset-layout')).not.toBeNull();
      // Only the layout controls while editing: no Transfer Money or Place Trade.
      expect(element().querySelector('.page-actions a[href="/transfer"]')).toBeNull();
      expect(element().querySelector('.page-actions a[href="/trade"]')).toBeNull();
      expect(element().querySelector('.dashboard-edit-hint')?.textContent).toContain(
        'Drag a widget',
      );
      expect(
        element().querySelector('.dashboard-widgets')?.classList.contains('dashboard-editing'),
      ).toBe(true);
      expect(item.classList.contains('ui-draggable-disabled')).toBe(false);
      expect(item.ddElement?.ddDraggable).toBeDefined();

      await click('dashboard-edit-widgets');
      expect(button('dashboard-edit-widgets')?.textContent?.trim()).toBe('Edit widgets');
      expect(button('dashboard-reset-layout')).toBeNull();
      expect(element().querySelector('.page-actions a[href="/transfer"]')).not.toBeNull();
      expect(element().querySelector('.page-actions a[href="/trade"]')).not.toBeNull();
      expect(item.classList.contains('ui-draggable-disabled')).toBe(true);
      expect(localStorage.getItem(layoutKey)).toBe(serializeWidgetOrder(DEFAULT_WIDGET_ORDER));
    });

    it("restores the signed-in client's saved order", async () => {
      await render(() => localStorage.setItem(layoutKey, serializeWidgetOrder(reversed)));
      expect(widgetOrder()).toEqual(reversed);
    });

    it('migrates a saved eight-widget layout without changing the remaining relative order', async () => {
      const legacy = [
        'transactions',
        'return',
        'cash',
        'orders',
        'portfolio',
        'holdings',
        'allocation',
        'performance',
      ];
      await render(() =>
        localStorage.setItem(layoutKey, JSON.stringify({ version: 1, order: legacy })),
      );
      expect(widgetOrder()).toEqual([
        'transactions',
        'cash',
        'orders',
        'portfolio',
        'holdings',
        'allocation',
        'performance',
      ]);
      expect(localStorage.getItem(layoutKey)).toBe(
        serializeWidgetOrder([
          'transactions',
          'cash',
          'orders',
          'portfolio',
          'holdings',
          'allocation',
          'performance',
        ]),
      );
    });

    it('falls back to the default order when the saved layout is invalid or belongs to someone else', async () => {
      await render(() => {
        localStorage.setItem(layoutKey, JSON.stringify({ version: 2, order: ['cash', 'cash'] }));
        localStorage.setItem(layoutStorageKey(99), serializeWidgetOrder(reversed));
      });
      expect(widgetOrder()).toEqual([...DEFAULT_WIDGET_ORDER]);
    });

    it('Reset layout returns to the default arrangement, which Done then saves', async () => {
      await render(() => localStorage.setItem(layoutKey, serializeWidgetOrder(reversed)));
      expect(widgetOrder()).toEqual(reversed);
      await click('dashboard-edit-widgets');
      await click('dashboard-reset-layout');
      expect(widgetOrder()).toEqual([...DEFAULT_WIDGET_ORDER]);
      expect(localStorage.getItem(layoutKey)).toBe(serializeWidgetOrder(reversed)); // not saved yet
      await click('dashboard-edit-widgets');
      expect(localStorage.getItem(layoutKey)).toBe(serializeWidgetOrder(DEFAULT_WIDGET_ORDER));
    });

    it('requests and caches backend history for each range without a metric toggle', async () => {
      await render();
      expect(
        element()
          .querySelector<HTMLButtonElement>('button[data-range="1D"]')
          ?.getAttribute('aria-pressed'),
      ).toBe('true');
      for (const range of ['5D', '1M', '1Y', '5Y']) {
        element().querySelector<HTMLButtonElement>(`button[data-range="${range}"]`)!.click();
        fixture.detectChanges();
        http.expectOne(`${HISTORY_API}?range=${range}`).flush(portfolioHistory(range));
        fixture.detectChanges();
      }

      expect(element().querySelector('[data-metric]')).toBeNull();
      element().querySelector<HTMLButtonElement>('button[data-range="1D"]')!.click();
      fixture.detectChanges();
      http.expectNone((request) => request.url === HISTORY_API);
      expect(
        element()
          .querySelector<HTMLButtonElement>('button[data-range="1D"]')
          ?.getAttribute('aria-pressed'),
      ).toBe('true');
    });
  });
});
