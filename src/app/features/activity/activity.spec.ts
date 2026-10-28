import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { OrderRow } from '../../core/models/portfolio.models';
import { AccountTransaction, OrderStatus } from '../../core/models/trading.models';
import { PortfolioService } from '../../core/services/portfolio.service';
import { ActivityPage } from './activity';

function orderRow(
  orderId: number,
  submittedAt: string,
  status: OrderStatus = 'FILLED',
  symbol = 'AAPL',
  name = 'Apple',
): OrderRow {
  return {
    order: {
      orderId,
      clientId: 12,
      instrumentId: 2,
      orderType: orderId % 2 ? 'BUY' : 'SELL',
      quantity: 1,
      status,
      reservedCash: null,
      submittedAt,
      acceptedAt: null,
      rejectedAt: null,
      failedAt: null,
      filledAt: null,
      executionPrice: 100,
      executionQuoteAsOf: null,
      tradeValue: 100,
      rejectionReason: null,
      failureReason: null,
    },
    symbol,
    name,
    amount: 100,
  };
}

function transaction(
  transactionId: number,
  createdAt: string,
  transactionType: string = 'DEPOSIT',
): AccountTransaction {
  return {
    transactionId,
    clientId: 12,
    orderId: transactionType === 'BUY' || transactionType === 'SELL' ? transactionId : null,
    transactionType,
    amount: transactionType === 'BUY' || transactionType === 'WITHDRAWAL' ? -100 : 100,
    balanceAfter: 1000,
    createdAt,
  };
}

describe('ActivityPage', () => {
  let fixture: ComponentFixture<ActivityPage>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let rows: ReturnType<typeof signal<OrderRow[]>>;
  let transactions: ReturnType<typeof signal<AccountTransaction[]>>;
  let error: ReturnType<typeof signal<string | null>>;
  let transactionError: ReturnType<typeof signal<string | null>>;
  let load: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const orderIds = () =>
    Array.from(
      element().querySelectorAll<HTMLElement>('app-orders-table tbody tr td:first-child'),
    ).map((cell) => cell.textContent?.trim());
  const transactionIds = () =>
    Array.from(
      element().querySelectorAll<HTMLElement>('app-transactions-table tbody .transaction-id'),
    ).map((cell) => cell.textContent?.trim());

  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    rows = signal([]);
    transactions = signal([]);
    error = signal(null);
    transactionError = signal(null);
    load = vi.fn().mockResolvedValue(undefined);
    refresh = vi.fn().mockResolvedValue(undefined);
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ActivityPage],
      providers: [
        {
          provide: PortfolioService,
          useValue: {
            orderRows: rows,
            transactions,
            loading: signal(false),
            hasLoaded: signal(true),
            error,
            transactionError,
            load,
            refresh,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams.asObservable() },
        },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivityPage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('defaults missing and invalid tab values to Orders and loads cached portfolio data once', () => {
    expect(element().querySelector('#orders-tab')?.getAttribute('aria-selected')).toBe('true');
    expect(element().querySelector('app-orders-table')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);

    queryParams.next(convertToParamMap({ tab: 'unknown' }));
    fixture.detectChanges();
    expect(element().querySelector('#orders-tab')?.getAttribute('aria-selected')).toBe('true');
  });

  it('restores URL-addressed tabs and asks the router to update tab selections', () => {
    queryParams.next(convertToParamMap({ tab: 'transactions' }));
    fixture.detectChanges();
    expect(element().querySelector('#transactions-tab')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(element().querySelector('app-transactions-table')).not.toBeNull();

    element().querySelector<HTMLButtonElement>('#orders-tab')?.click();
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { tab: 'orders' },
      queryParamsHandling: 'merge',
    });

    queryParams.next(convertToParamMap({ tab: 'orders' }));
    fixture.detectChanges();
    expect(element().querySelector('#orders-tab')?.getAttribute('aria-selected')).toBe('true');
  });

  it('sorts orders newest first with descending IDs as a timestamp tie-breaker', () => {
    rows.set([
      orderRow(1, '2026-10-20T14:00:00Z'),
      orderRow(2, '2026-10-21T14:00:00Z'),
      orderRow(3, '2026-10-21T14:00:00Z'),
    ]);
    fixture.detectChanges();

    expect(orderIds()).toEqual(['ORD-3', 'ORD-2', 'ORD-1']);
  });

  it('searches order rows by trimmed, case-insensitive ticker and company-name fragments', () => {
    rows.set([
      orderRow(1, '2026-10-20T14:00:00Z', 'FILLED', 'AAPL', 'Apple Inc.'),
      orderRow(2, '2026-10-21T14:00:00Z', 'FILLED', 'MSFT', 'Microsoft Corporation'),
      orderRow(3, '2026-10-22T14:00:00Z', 'FILLED', 'NVDA', 'NVIDIA Corporation'),
      orderRow(4, '2026-10-23T14:00:00Z', 'FILLED', 'BTC/USD', 'Bitcoin / U.S. Dollar'),
    ]);
    fixture.detectChanges();

    setInput('#activity-instrument-search', 'aapl');
    expect(orderIds()).toEqual(['ORD-1']);
    setInput('#activity-instrument-search', ' app ');
    expect(orderIds()).toEqual(['ORD-1']);
    setInput('#activity-instrument-search', 'MICRO');
    expect(orderIds()).toEqual(['ORD-2']);
    setInput('#activity-instrument-search', 'btc');
    expect(orderIds()).toEqual(['ORD-4']);
    setInput('#activity-instrument-search', 'USD');
    expect(orderIds()).toEqual(['ORD-4']);
    setInput('#activity-instrument-search', '');
    expect(orderIds()).toEqual(['ORD-4', 'ORD-3', 'ORD-2', 'ORD-1']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('combines instrument, date, and status filters while preserving newest-first order', () => {
    rows.set([
      orderRow(1, '2026-09-30T14:00:00Z', 'FILLED', 'AAPL', 'Apple'),
      orderRow(2, '2026-10-10T14:00:00Z', 'FILLED', 'AAPL', 'Apple'),
      orderRow(3, '2026-10-20T14:00:00Z', 'FILLED', 'AAPL', 'Apple'),
      orderRow(4, '2026-10-21T14:00:00Z', 'REJECTED', 'AAPL', 'Apple'),
      orderRow(5, '2026-10-22T14:00:00Z', 'FILLED', 'MSFT', 'Microsoft'),
    ]);
    fixture.detectChanges();

    setInput('#activity-instrument-search', 'apple');
    setInput('#activity-start-date', '2026-10-01');
    setInput('#activity-end-date', '2026-10-28');
    setSelect('select', 'FILLED');

    expect(orderIds()).toEqual(['ORD-3', 'ORD-2']);
  });

  it('combines inclusive Eastern dates and actual order status, then resets filters', () => {
    rows.set([
      orderRow(1, '2026-10-01T03:30:00Z', 'FILLED'), // Sep 30 Eastern
      orderRow(2, '2026-10-01T04:00:00Z', 'FILLED'),
      orderRow(3, '2026-10-29T03:59:59Z', 'FILLED'), // Oct 28 Eastern
      orderRow(4, '2026-10-29T04:00:00Z', 'FILLED'),
      orderRow(5, '2026-10-15T16:00:00Z', 'REJECTED'),
    ]);
    fixture.detectChanges();

    setInput('#activity-start-date', '2026-10-01');
    setInput('#activity-end-date', '2026-10-28');
    setSelect('select', 'FILLED');
    expect(orderIds()).toEqual(['ORD-3', 'ORD-2']);

    element().querySelector<HTMLButtonElement>('.filter-reset')?.click();
    fixture.detectChanges();
    expect(orderIds()).toEqual(['ORD-4', 'ORD-3', 'ORD-5', 'ORD-2', 'ORD-1']);
  });

  it('clearly rejects an inverted date range and distinguishes filtered emptiness', () => {
    rows.set([orderRow(1, '2026-10-10T14:00:00Z')]);
    fixture.detectChanges();
    setInput('#activity-start-date', '2026-10-20');
    setInput('#activity-end-date', '2026-10-10');

    expect(text()).toContain('Start date must be on or before end date.');
    expect(text()).toContain('Invalid date range');

    setInput('#activity-start-date', '2026-10-11');
    setInput('#activity-end-date', '2026-10-12');
    expect(text()).toContain('No orders match your filters.');
    expect(text()).not.toContain('Invalid date range');
  });

  it('renders only the current 25-row page and keeps every matching order reachable', () => {
    rows.set(
      Array.from({ length: 26 }, (_, index) =>
        orderRow(index + 1, `2026-10-${String(index + 1).padStart(2, '0')}T14:00:00Z`),
      ),
    );
    fixture.detectChanges();

    expect(orderIds()).toHaveLength(25);
    expect(text()).toContain('Showing 1–25 of 26 orders');
    expect(text()).toContain('Page 1 of 2');
    element().querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click();
    fixture.detectChanges();
    expect(orderIds()).toEqual(['ORD-1']);
    expect(text()).toContain('Showing 26–26 of 26 orders');
  });

  it('returns to page one when the instrument search changes', () => {
    rows.set([
      ...Array.from({ length: 26 }, (_, index) =>
        orderRow(index + 1, '2026-10-20T14:00:00Z', 'FILLED', 'AAPL', 'Apple'),
      ),
      orderRow(27, '2026-10-20T14:00:00Z', 'FILLED', 'MSFT', 'Microsoft'),
    ]);
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click();
    fixture.detectChanges();
    expect(text()).toContain('Page 2 of 2');

    setInput('#activity-instrument-search', 'AAPL');
    expect(text()).toContain('Page 1 of 2');
    expect(orderIds()[0]).toBe('ORD-26');
  });

  it('clears instrument search independently and as part of resetting order filters', () => {
    rows.set([
      orderRow(1, '2026-10-20T14:00:00Z', 'FILLED', 'AAPL', 'Apple'),
      orderRow(2, '2026-10-21T14:00:00Z', 'FILLED', 'MSFT', 'Microsoft'),
    ]);
    fixture.detectChanges();

    setInput('#activity-instrument-search', 'AAPL');
    expect(element().querySelector<HTMLButtonElement>('.filter-reset')?.disabled).toBe(false);
    element().querySelector<HTMLButtonElement>('.instrument-search-clear')?.click();
    fixture.detectChanges();
    expect(orderIds()).toEqual(['ORD-2', 'ORD-1']);

    setInput('#activity-instrument-search', 'MSFT');
    element().querySelector<HTMLButtonElement>('.filter-reset')?.click();
    fixture.detectChanges();
    expect(element().querySelector<HTMLInputElement>('#activity-instrument-search')?.value).toBe(
      '',
    );
    expect(orderIds()).toEqual(['ORD-2', 'ORD-1']);
    expect(element().querySelector<HTMLButtonElement>('.filter-reset')?.disabled).toBe(true);
  });

  it('shows search-specific filtered emptiness without replacing the empty-account state', () => {
    rows.set([orderRow(1, '2026-10-20T14:00:00Z')]);
    fixture.detectChanges();
    setInput('#activity-instrument-search', 'NOT-HELD');
    expect(text()).toContain('No orders match your filters.');
    expect(text()).toContain('Try a different ticker or company name, or reset your filters.');

    rows.set([]);
    fixture.detectChanges();
    expect(text()).toContain('No orders yet.');
    expect(text()).toContain('Orders you place will appear here with their status and outcome.');
  });

  it('sorts and filters transaction types without conflating trades with funding', () => {
    queryParams.next(convertToParamMap({ tab: 'transactions' }));
    transactions.set([
      transaction(1, '2026-10-20T14:00:00Z', 'DEPOSIT'),
      transaction(2, '2026-10-21T14:00:00Z', 'BUY'),
      transaction(3, '2026-10-21T14:00:00Z', 'SELL'),
      transaction(4, '2026-10-19T14:00:00Z', 'WITHDRAWAL'),
    ]);
    fixture.detectChanges();
    expect(transactionIds()).toEqual(['TXN-3', 'TXN-2', 'TXN-1', 'TXN-4']);

    setSelect('select', 'BUY');
    expect(transactionIds()).toEqual(['TXN-2']);
    expect(text()).toContain('-$100.00');
    expect(text()).toContain('ORD-2');
  });

  it('does not apply the order instrument search to the Transactions tab', () => {
    rows.set([orderRow(1, '2026-10-20T14:00:00Z', 'FILLED', 'AAPL', 'Apple')]);
    transactions.set([
      transaction(1, '2026-10-20T14:00:00Z', 'DEPOSIT'),
      transaction(2, '2026-10-21T14:00:00Z', 'WITHDRAWAL'),
    ]);
    fixture.detectChanges();
    setInput('#activity-instrument-search', 'NO-MATCH');

    queryParams.next(convertToParamMap({ tab: 'transactions' }));
    fixture.detectChanges();
    expect(element().querySelector('#activity-instrument-search')).toBeNull();
    expect(transactionIds()).toEqual(['TXN-2', 'TXN-1']);
  });

  it('keeps orders usable while showing and retrying a transaction-only error', () => {
    rows.set([orderRow(1, '2026-10-20T14:00:00Z')]);
    transactionError.set('Your transaction history could not be loaded.');
    fixture.detectChanges();
    expect(orderIds()).toEqual(['ORD-1']);
    expect(text()).not.toContain('Your transaction history could not be loaded.');

    queryParams.next(convertToParamMap({ tab: 'transactions' }));
    fixture.detectChanges();
    expect(text()).toContain('Your transaction history could not be loaded.');
    element().querySelector<HTMLButtonElement>('.alert-action')?.click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  function setInput(selector: string, value: string): void {
    const input = element().querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`Missing input: ${selector}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function setSelect(selector: string, value: string): void {
    const select = element().querySelector<HTMLSelectElement>(selector);
    if (!select) throw new Error(`Missing select: ${selector}`);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }
});
