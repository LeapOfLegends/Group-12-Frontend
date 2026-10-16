import { Order, OrderStatus } from '../models/trading.models';

const REJECTION_MESSAGES: Record<string, string> = {
  INSTRUMENT_NOT_FOUND: 'The instrument could not be found.',
  INSTRUMENT_NOT_TRADABLE: 'This instrument is not currently tradable.',
  MISSING_QUOTE: 'No market quote is available for this instrument right now.',
  STALE_QUOTE: 'The market quote was too old to price the order. Please try again once market data refreshes.',
  INSUFFICIENT_FUNDS: 'There was not enough buying power to cover this order.',
  INSUFFICIENT_HOLDINGS: 'You do not hold enough of this instrument to sell that quantity.',
};

const FAILURE_MESSAGES: Record<string, string> = {
  INSTRUMENT_NOT_FOUND: 'The instrument could not be found at execution time.',
  INSTRUMENT_NOT_TRADABLE: 'The instrument stopped being tradable before execution.',
  MARKET_QUOTE_TIMEOUT: 'Execution timed out while waiting for a current market quote. No money moved.',
  INVALID_RESERVED_CASH: 'The cash reservation for this order was invalid. No money moved.',
  PRICE_EXCEEDS_RESERVED_CASH: 'The execution price moved above the cash reserved for this order. No money moved.',
  INSUFFICIENT_ACTUAL_CASH: 'Your cash balance was no longer sufficient at execution time. No money moved.',
  HOLDING_NOT_FOUND: 'The holding was no longer available at execution time.',
  INSUFFICIENT_HOLDINGS: 'The holding was no longer large enough at execution time.',
};

export function describeOrderOutcome(order: Order): string {
  switch (order.status) {
    case 'SUBMITTED':
      return 'Your order has been received and is being checked against the trading rules.';
    case 'ACCEPTED':
      return 'Your order was accepted and is being executed at the current market quote.';
    case 'FILLED':
      return 'Your order was executed. Holdings and cash have been updated.';
    case 'REJECTED':
      return REJECTION_MESSAGES[order.rejectionReason ?? ''] ?? `The order was rejected${order.rejectionReason ? ` (${humanize(order.rejectionReason)})` : ''}.`;
    case 'FAILED':
      return FAILURE_MESSAGES[order.failureReason ?? ''] ?? `Execution failed${order.failureReason ? ` (${humanize(order.failureReason)})` : ''}.`;
  }
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'ACCEPTED':
      return 'Executing';
    case 'FILLED':
      return 'Filled';
    case 'REJECTED':
      return 'Rejected';
    case 'FAILED':
      return 'Failed';
  }
}

export function isSettled(status: OrderStatus): boolean {
  return status === 'FILLED' || status === 'REJECTED' || status === 'FAILED';
}

export function humanize(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
