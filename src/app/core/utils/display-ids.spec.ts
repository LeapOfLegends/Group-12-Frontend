import { formatOrderId, formatTransactionId, parseOrderIdInput } from './display-ids';

describe('display ID utilities', () => {
  it('formats numeric order and transaction IDs without changing their values', () => {
    expect(formatOrderId(47)).toBe('ORD-47');
    expect(formatTransactionId(7)).toBe('TXN-7');
  });

  it('parses numeric and case-insensitive prefixed order IDs', () => {
    expect(parseOrderIdInput('47')).toBe(47);
    expect(parseOrderIdInput('  ord-47  ')).toBe(47);
  });

  it.each(['', 'ORD-', 'ORD-4x', 'ORDER-47', 'ORD--47', '0', '-47'])(
    'rejects malformed order ID input %j',
    (value) => expect(parseOrderIdInput(value)).toBeNull(),
  );
});
