import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ClientApiService } from '../api/client-api.service';
import { HoldingsApiService } from '../api/holdings-api.service';
import { OrdersApiService } from '../api/orders-api.service';
import { AuthService } from '../auth/auth.service';
import { AccountTransaction, CatalogInstrument } from '../models/trading.models';
import { InstrumentCatalogService } from './instrument-catalog.service';
import { PortfolioService } from './portfolio.service';

const instrument = (price: number): CatalogInstrument => ({
  instrumentId: 2,
  symbol: 'AAPL',
  instrumentName: 'Apple',
  assetClass: 'EQUITY',
  currency: 'USD',
  tradable: true,
  bidPrice: price - 1,
  askPrice: price + 1,
  lastPrice: price,
  quoteAsOf: '2026-10-23T14:00:00Z',
  lastTradeAsOf: '2026-10-23T14:00:00Z',
});

describe('PortfolioService synchronization', () => {
  const user = signal<any>({ kind: 'client', id: 12 });
  const token = signal('token-a');
  const instruments = signal<CatalogInstrument[]>([instrument(100)]);
  let balance$: Subject<any>;
  let holdings$: Subject<any[]>;
  let orders$: Subject<any[]>;
  let transactions$: Subject<AccountTransaction[]>;

  beforeEach(() => {
    user.set({ kind: 'client', id: 12 });
    token.set('token-a');
    instruments.set([instrument(100)]);
    balance$ = new Subject();
    holdings$ = new Subject();
    orders$ = new Subject();
    transactions$ = new Subject();
    TestBed.configureTestingModule({
      providers: [
        PortfolioService,
        { provide: AuthService, useValue: { user, accessToken: () => token() } },
        {
          provide: ClientApiService,
          useValue: { getBalance: () => balance$, listMyTransactions: () => transactions$ },
        },
        { provide: HoldingsApiService, useValue: { listMine: () => holdings$ } },
        { provide: OrdersApiService, useValue: { listMine: () => orders$ } },
        {
          provide: InstrumentCatalogService,
          useValue: {
            instruments,
            getMany: () => of(new Map([[2, instruments()[0]]])),
          },
        },
      ],
    });
  });

  function finishLoad(): void {
    balance$.next({ clientId: 12, accountBalance: 1000 });
    balance$.complete();
    holdings$.next([
      {
        holdingId: 1,
        clientId: 12,
        instrumentId: 2,
        quantity: 10,
        averageCost: 90,
        updatedAt: null,
      },
    ]);
    holdings$.complete();
    orders$.next([]);
    orders$.complete();
    transactions$.next([]);
    transactions$.complete();
  }

  it('revalues positions immediately when the canonical quote changes', async () => {
    const service = TestBed.inject(PortfolioService);
    const loading = service.load();
    finishLoad();
    await loading;
    expect(service.summary().holdingsValue).toBe(1000);

    instruments.set([instrument(110)]);
    expect(service.summary().holdingsValue).toBe(1100);
  });

  it('does not apply a response from a previous session', async () => {
    const service = TestBed.inject(PortfolioService);
    const loading = service.load();
    user.set({ kind: 'client', id: 99 });
    token.set('token-b');
    finishLoad();
    await loading;
    expect(service.cash()).toBeNull();
    expect(service.holdings()).toEqual([]);
  });

  it('loads funding and filled-order transaction history alongside the portfolio', async () => {
    const service = TestBed.inject(PortfolioService);
    const transactions: AccountTransaction[] = [
      {
        transactionId: 1,
        clientId: 12,
        orderId: null,
        transactionType: 'DEPOSIT',
        amount: 1000,
        balanceAfter: 1000,
        createdAt: '2026-10-23T14:00:00Z',
      },
      {
        transactionId: 2,
        clientId: 12,
        orderId: 20,
        transactionType: 'BUY',
        amount: -250,
        balanceAfter: 750,
        createdAt: '2026-10-23T15:00:00Z',
      },
      {
        transactionId: 3,
        clientId: 12,
        orderId: 21,
        transactionType: 'SELL',
        amount: 125,
        balanceAfter: 875,
        createdAt: '2026-10-23T16:00:00Z',
      },
    ];
    const loading = service.load();
    transactions$.next(transactions);
    transactions$.complete();
    finishLoad();
    await loading;

    expect(service.transactions()).toEqual(transactions);
    expect(service.recentTransactions()).toEqual([
      transactions[2],
      transactions[1],
      transactions[0],
    ]);
    expect(service.transactionCount()).toBe(3);
    expect(service.transactionError()).toBeNull();
  });

  it('keeps the portfolio available when transaction history fails', async () => {
    const service = TestBed.inject(PortfolioService);
    const loading = service.load();
    transactions$.error(new Error('Ledger unavailable'));
    finishLoad();
    await loading;

    expect(service.cash()).toBe(1000);
    expect(service.summary().holdingsValue).toBe(1000);
    expect(service.transactions()).toEqual([]);
    expect(service.transactionError()).toBeTruthy();
    expect(service.error()).toBeNull();
    expect(service.hasLoaded()).toBe(true);
    expect(service.loading()).toBe(false);
  });

  it('does not apply transaction errors from a previous session', async () => {
    const service = TestBed.inject(PortfolioService);
    const loading = service.load();
    token.set('token-b');
    transactions$.error(new Error('Ledger unavailable'));
    finishLoad();
    await loading;

    expect(service.transactionError()).toBeNull();
    expect(service.transactions()).toEqual([]);
    expect(service.hasLoaded()).toBe(false);
  });

  it('clears a transaction error after a successful silent refresh', async () => {
    const service = TestBed.inject(PortfolioService);
    const loading = service.load();
    transactions$.error(new Error('Ledger unavailable'));
    finishLoad();
    await loading;
    expect(service.transactionError()).toBeTruthy();

    balance$ = new Subject();
    holdings$ = new Subject();
    orders$ = new Subject();
    transactions$ = new Subject();
    const refreshing = service.refreshSilently();
    expect(service.loading()).toBe(false);
    finishLoad();
    await refreshing;

    expect(service.transactionError()).toBeNull();
    expect(service.error()).toBeNull();
    expect(service.hasLoaded()).toBe(true);
  });
});
