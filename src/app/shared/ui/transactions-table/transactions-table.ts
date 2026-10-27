import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccountTransaction } from '../../../core/models/trading.models';
import { formatOrderId, formatTransactionId } from '../../../core/utils/display-ids';
import { DateTimePipe, MoneyPipe, SignedMoneyPipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../empty-state/empty-state';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton';
import { TableScrollDirective } from '../table-scroll';

/** Recent account funding and filled-order cash movements. */
@Component({
  selector: 'app-transactions-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateTimePipe, MoneyPipe, SignedMoneyPipe, EmptyStateComponent, LoadingSkeletonComponent, TableScrollDirective],
  template: `
    @if (loading()) {
      <app-loading-skeleton variant="table" [lines]="4" label="Loading transactions" />
    } @else if (rows().length === 0) {
      <app-empty-state
        icon="transfer"
        title="No transactions yet"
        message="Funding and completed trade activity will appear here."
      />
    } @else {
      <div class="table-wrap" [appTableScroll]="visibleRows()" tableScrollLabel="Recent transactions">
        <table class="table">
          <caption class="visually-hidden">
            Recent account transactions
          </caption>
          <thead>
            <tr>
              <th scope="col">Transaction ID</th>
              <th scope="col">Type</th>
              <th scope="col" class="num">Amount</th>
              <th scope="col" class="num">Balance after</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            @for (transaction of rows(); track transaction.transactionId) {
              <tr>
                <td class="tabular transaction-id">
                  {{ formatTransactionId(transaction.transactionId) }}
                </td>
                <td>
                  <span
                    class="transaction-type"
                    [class.transaction-positive]="isCashIn(transaction)"
                    [class.transaction-negative]="!isCashIn(transaction)"
                  >
                    {{ typeLabel(transaction) }}
                  </span>
                  @if (transaction.orderId !== null) {
                    <span class="order-reference"
                      >{{ formatOrderId(transaction.orderId) }}</span
                    >
                  }
                </td>
                <td
                  class="num cell-primary"
                  [class.amount-positive]="isCashIn(transaction)"
                  [class.amount-negative]="!isCashIn(transaction)"
                >
                  {{ transaction.amount | signedMoney }}
                </td>
                <td class="num">{{ transaction.balanceAfter | money }}</td>
                <td>{{ transaction.createdAt | dateTime }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .transaction-type {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 600;
    }

    .transaction-id {
      white-space: nowrap;
    }

    .transaction-positive {
      color: var(--color-positive);
      background: color-mix(in srgb, var(--color-positive) 12%, transparent);
    }

    .transaction-negative {
      color: var(--color-negative);
      background: color-mix(in srgb, var(--color-negative) 12%, transparent);
    }

    .order-reference {
      display: block;
      margin-top: 3px;
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
    }

    .amount-positive {
      color: var(--color-positive);
    }

    .amount-negative {
      color: var(--color-negative);
    }
  `,
})
export class TransactionsTableComponent {
  readonly rows = input<AccountTransaction[]>([]);
  readonly loading = input<boolean>(false);
  readonly visibleRows = input<number | null>(null);
  protected readonly formatOrderId = formatOrderId;
  protected readonly formatTransactionId = formatTransactionId;

  protected isCashIn(transaction: AccountTransaction): boolean {
    return transaction.transactionType === 'DEPOSIT' || transaction.transactionType === 'SELL';
  }

  protected typeLabel(transaction: AccountTransaction): string {
    switch (transaction.transactionType) {
      case 'DEPOSIT':
        return 'Deposit';
      case 'WITHDRAWAL':
        return 'Withdrawal';
      case 'BUY':
        return 'Buy';
      case 'SELL':
        return 'Sell';
      default:
        return transaction.transactionType;
    }
  }
}
