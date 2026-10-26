import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccountTransaction } from '../../../core/models/trading.models';
import { DateTimePipe, MoneyPipe, SignedMoneyPipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../empty-state/empty-state';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton';

/** Recent account deposits and withdrawals. */
@Component({
  selector: 'app-transactions-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateTimePipe, MoneyPipe, SignedMoneyPipe, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    @if (loading()) {
      <app-loading-skeleton variant="table" [lines]="4" label="Loading transactions" />
    } @else if (rows().length === 0) {
      <app-empty-state icon="transfer" title="No deposits or withdrawals yet" message="Account funding activity will appear here." />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <caption class="visually-hidden">Recent deposits and withdrawals</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col" class="num">Amount</th>
              <th scope="col" class="num">Balance after</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            @for (transaction of rows(); track transaction.transactionId) {
              <tr>
                <td>
                  <span class="transaction-type" [class.transaction-deposit]="transaction.transactionType === 'DEPOSIT'" [class.transaction-withdrawal]="transaction.transactionType === 'WITHDRAWAL'">
                    {{ transaction.transactionType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal' }}
                  </span>
                </td>
                <td class="num cell-primary" [class.amount-positive]="transaction.transactionType === 'DEPOSIT'" [class.amount-negative]="transaction.transactionType === 'WITHDRAWAL'">
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

    .transaction-deposit {
      color: var(--color-positive);
      background: color-mix(in srgb, var(--color-positive) 12%, transparent);
    }

    .transaction-withdrawal {
      color: var(--color-negative);
      background: color-mix(in srgb, var(--color-negative) 12%, transparent);
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
}
