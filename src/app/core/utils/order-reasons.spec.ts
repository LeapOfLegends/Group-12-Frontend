import { Order } from '../models/trading.models';
import { describeOrderOutcome, humanize, isSettled, orderStatusLabel } from './order-reasons';

function order(overrides: Partial<Order>): Order {
  return {
    orderId: 1,
    clientId: 1,
    instrumentId: 1,
    orderType: 'BUY',
    quantity: 1,
    status: 'SUBMITTED',
    reservedCash: null,
    submittedAt: '',
    acceptedAt: null,
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

describe('order outcome descriptions', () => {
  it('maps backend rejection and failure codes to plain language', () => {
    expect(describeOrderOutcome(order({ status: 'REJECTED', rejectionReason: 'INSUFFICIENT_FUNDS' }))).toContain('buying power');
    expect(describeOrderOutcome(order({ status: 'REJECTED', rejectionReason: 'STALE_QUOTE' }))).toContain('too old');
    expect(describeOrderOutcome(order({ status: 'FAILED', failureReason: 'MARKET_QUOTE_TIMEOUT' }))).toContain('No money moved');
    expect(describeOrderOutcome(order({ status: 'REJECTED', rejectionReason: 'SOMETHING_NEW' }))).toBe('The order was rejected (Something new).');
    expect(describeOrderOutcome(order({ status: 'FILLED' }))).toContain('executed');
  });

  it('labels statuses and knows which are final', () => {
    expect(orderStatusLabel('ACCEPTED')).toBe('Executing');
    expect(isSettled('ACCEPTED')).toBe(false);
    expect(isSettled('FILLED')).toBe(true);
    expect(isSettled('FAILED')).toBe(true);
    expect(humanize('PRICE_EXCEEDS_RESERVED_CASH')).toBe('Price exceeds reserved cash');
  });
});
