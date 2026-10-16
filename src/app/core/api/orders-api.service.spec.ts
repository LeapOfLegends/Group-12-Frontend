import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { OrderStatus } from '../models/trading.models';
import { OrdersApiService } from './orders-api.service';

const BASE = `${environment.tradingApiUrl}/api/orders`;

function record(status: OrderStatus, extra: Record<string, unknown> = {}) {
  return {
    orderId: 5,
    clientId: 12,
    instrumentId: 2,
    orderType: 'BUY',
    quantity: 2,
    status,
    reservedCash: 680,
    submittedAt: '2026-10-13T10:00:00Z',
    acceptedAt: '2026-10-13T10:00:01Z',
    rejectedAt: null,
    failedAt: null,
    filledAt: null,
    executionPrice: null,
    executionQuoteAsOf: null,
    tradeValue: null,
    rejectionReason: null,
    failureReason: null,
    ...extra,
  };
}

describe('OrdersApiService', () => {
  let service: OrdersApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrdersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('submits the CreateOrderRequest body unchanged and normalises the response', () => {
    let result: unknown = null;
    service.submit({ clientId: 12, instrumentId: 2, orderType: 'BUY', quantity: 2 }).subscribe((order) => (result = order));
    const request = http.expectOne(BASE);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ clientId: 12, instrumentId: 2, orderType: 'BUY', quantity: 2 });
    request.flush(record('ACCEPTED', { quantity: '2.00000000', reservedCash: '680.0000000000000000' }), { status: 201, statusText: 'Created' });
    expect(result).toMatchObject({ orderId: 5, status: 'ACCEPTED', quantity: 2, reservedCash: 680, filledAt: null });
  });

  it('polls the order until it reaches a final state', () => {
    vi.useFakeTimers();
    const seen: OrderStatus[] = [];
    let completed = false;
    service.pollUntilSettled(5).subscribe({ next: (order) => seen.push(order.status), complete: () => (completed = true) });

    vi.advanceTimersByTime(environment.orderPollIntervalMs);
    http.expectOne(`${BASE}/5`).flush(record('ACCEPTED'));
    expect(completed).toBe(false);

    vi.advanceTimersByTime(environment.orderPollIntervalMs);
    http.expectOne(`${BASE}/5`).flush(record('FILLED', { filledAt: '2026-10-13T10:00:05Z', executionPrice: 340, tradeValue: 680 }));

    expect(seen).toEqual(['ACCEPTED', 'FILLED']);
    expect(completed).toBe(true);

    vi.advanceTimersByTime(environment.orderPollIntervalMs * 2);
    http.expectNone(`${BASE}/5`);
  });
});
