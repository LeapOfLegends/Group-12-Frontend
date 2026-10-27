import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { Order } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { OrderLookupComponent } from './order-lookup';

const ORDER: Order = {
  orderId: 47,
  clientId: 12,
  instrumentId: 2,
  orderType: 'BUY',
  quantity: 2,
  status: 'FILLED',
  reservedCash: null,
  submittedAt: '2026-10-24T14:00:00Z',
  acceptedAt: '2026-10-24T14:00:01Z',
  rejectedAt: null,
  failedAt: null,
  filledAt: '2026-10-24T14:00:05Z',
  executionPrice: 100,
  executionQuoteAsOf: '2026-10-24T14:00:04Z',
  tradeValue: 200,
  rejectionReason: null,
  failureReason: null,
};

describe('OrderLookupComponent', () => {
  let fixture: ComponentFixture<OrderLookupComponent>;
  const getOrder = vi.fn(() => of(ORDER));
  const getById = vi.fn(() =>
    of({
      instrumentId: 2,
      symbol: 'AAPL',
      instrumentName: 'Apple',
      assetClass: 'EQUITY',
      currency: 'USD',
      tradable: true,
      bidPrice: 99,
      askPrice: 100,
      lastPrice: 100,
      quoteAsOf: '2026-10-24T14:00:00Z',
      lastTradeAsOf: '2026-10-24T14:00:00Z',
    }),
  );

  beforeEach(() => {
    getOrder.mockClear();
    getById.mockClear();
    TestBed.configureTestingModule({
      imports: [OrderLookupComponent],
      providers: [
        { provide: OrdersApiService, useValue: { getOrder, pollAdminUntilSettled: vi.fn() } },
        {
          provide: InstrumentCatalogService,
          useValue: { getById, instruments: () => [] },
        },
      ],
    });
    fixture = TestBed.createComponent(OrderLookupComponent);
    fixture.detectChanges();
  });

  it('accepts numeric and case-insensitive prefixed input but calls the API with numbers', async () => {
    const component = fixture.componentInstance;

    component['form'].controls.orderId.setValue('47');
    await component['search']();
    component['form'].controls.orderId.setValue('  ord-47  ');
    await component['search']();
    fixture.detectChanges();

    expect(getOrder).toHaveBeenNthCalledWith(1, 47);
    expect(getOrder).toHaveBeenNthCalledWith(2, 47);
    expect(fixture.nativeElement.textContent).toContain('Order ORD-47');
    expect(
      fixture.nativeElement.querySelector('#order-lookup-input').getAttribute('placeholder'),
    ).toBe('Order ID, e.g. ORD-47');
  });

  it('rejects malformed prefixed IDs before making an API request', async () => {
    const component = fixture.componentInstance;
    component['form'].controls.orderId.setValue('ORD-4x');

    await component['search']();
    fixture.detectChanges();

    expect(getOrder).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter an order ID such as ORD-47 or 47.');
  });
});
