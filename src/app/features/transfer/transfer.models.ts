import { TransferMode } from './transfer-form';

/**
 * What the transfer page hands to the confirmation page once Group-12-Backend has
 * answered. The backend settles deposits and withdrawals synchronously and returns
 * the new balance, so a receipt is only ever created as `completed`; `pending` is
 * reserved for a backend that acknowledges a transfer before settling it.
 */
export interface TransferReceipt {
  clientId: number;
  mode: TransferMode;
  amount: number;
  status: 'completed' | 'pending';
  balanceBefore: number;
  /** Balance returned by the backend; null until the transfer is confirmed. */
  balanceAfter: number | null;
  /** Not issued by the current backend (AccountBalanceDTO has no id), hence nullable. */
  transactionId: number | null;
  /** ISO timestamp taken when the backend's confirmation arrived. */
  confirmedAt: string;
}

export function isTransferReceipt(value: unknown): value is TransferReceipt {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt['clientId'] === 'number' &&
    (receipt['mode'] === 'deposit' || receipt['mode'] === 'withdraw') &&
    typeof receipt['amount'] === 'number' &&
    (receipt['status'] === 'completed' || receipt['status'] === 'pending') &&
    typeof receipt['balanceBefore'] === 'number' &&
    (typeof receipt['balanceAfter'] === 'number' || receipt['balanceAfter'] === null) &&
    (typeof receipt['transactionId'] === 'number' || receipt['transactionId'] === null) &&
    typeof receipt['confirmedAt'] === 'string'
  );
}
