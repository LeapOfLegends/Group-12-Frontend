/** Presentation-only identifiers. Domain models and API requests keep their numeric IDs. */
export function formatOrderId(orderId: number): string {
  return `ORD-${orderId}`;
}

export function formatTransactionId(transactionId: number): string {
  return `TXN-${transactionId}`;
}

/** Accepts the numeric or display form used by the administrator order lookup. */
export function parseOrderIdInput(value: string): number | null {
  const match = /^(?:ORD-)?([1-9]\d*)$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const orderId = Number(match[1]);
  return Number.isSafeInteger(orderId) ? orderId : null;
}
