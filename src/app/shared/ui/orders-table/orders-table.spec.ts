import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderRow } from '../../../core/models/portfolio.models';
import { OrdersTableComponent } from './orders-table';

const ROW: OrderRow = {
  order: {
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
  },
  symbol: 'AAPL',
  name: 'Apple',
  amount: 200,
};

describe('OrdersTableComponent', () => {
  let fixture: ComponentFixture<OrdersTableComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OrdersTableComponent] });
    fixture = TestBed.createComponent(OrdersTableComponent);
  });

  it('displays numeric order IDs using the shared display format', () => {
    fixture.componentRef.setInput('rows', [ROW]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('tbody td')?.textContent.trim()).toBe('ORD-47');
  });
});
