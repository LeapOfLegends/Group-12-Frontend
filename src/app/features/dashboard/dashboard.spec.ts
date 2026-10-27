import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { makeToken } from '../../testing/jwt-fixtures';
import { DashboardPage } from './dashboard';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const API = environment.tradingApiUrl;

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

  async function setup(kind: 'client' | 'admin'): Promise<void> {
    localStorage.clear();
    seedSession(kind);
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
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
    expect(text).not.toContain('New Trade');
    // The price search sits in the header above the date, and is idle until used.
    const header = fixture.nativeElement.querySelector('.page-header .page-title') as HTMLElement;
    expect(header.firstElementChild?.tagName.toLowerCase()).toBe('app-instrument-search');
    http.expectNone(`${API}/instruments`);
  });
});
