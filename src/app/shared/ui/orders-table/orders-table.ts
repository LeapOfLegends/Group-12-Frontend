import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OrderRow } from '../../../core/models/portfolio.models';
import { formatOrderId } from '../../../core/utils/display-ids';
import { describeOrderOutcome } from '../../../core/utils/order-reasons';
import { DateTimePipe, MoneyPipe, PricePipe, QuantityPipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../empty-state/empty-state';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton';
import { StatusBadgeComponent } from '../status-badge/status-badge';

/** Chronological order blotter with backend status and outcome details. */
@Component({
  selector: 'app-orders-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyPipe,
    PricePipe,
    QuantityPipe,
    DateTimePipe,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  template: `
    @if (loading()) {
      <app-loading-skeleton variant="table" [lines]="4" label="Loading orders" />
    } @else if (rows().length === 0) {
      <app-empty-state icon="activity" [title]="emptyTitle()" [message]="emptyMessage()" />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <caption class="visually-hidden">
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Type</th>
              <th scope="col">Instrument</th>
              <th scope="col" class="num">Quantity</th>
              <th scope="col" class="num">Price</th>
              <th scope="col" class="num">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Submitted</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.order.orderId) {
              <tr>
                <td class="tabular">{{ formatOrderId(row.order.orderId) }}</td>
                <td>
                  <span
                    class="side"
                    [class.side-buy]="row.order.orderType === 'BUY'"
                    [class.side-sell]="row.order.orderType === 'SELL'"
                  >
                    {{ row.order.orderType === 'BUY' ? 'Buy' : 'Sell' }}
                  </span>
                </td>
                <td>
                  <span class="cell-primary">{{ row.symbol }}</span>
                  <span class="cell-secondary">{{ row.name }}</span>
                </td>
                <td class="num">{{ row.order.quantity | quantity }}</td>
                <td class="num">
                  @if (row.order.executionPrice !== null) {
                    {{ row.order.executionPrice | price }}
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
                <td class="num">
                  {{ row.amount | money }}
                  @if (row.order.status === 'ACCEPTED' && row.order.orderType === 'BUY') {
                    <span class="cell-secondary">reserved</span>
                  }
                </td>
                <td>
                  <app-status-badge [status]="row.order.status" />
                  @if (row.order.status === 'REJECTED' || row.order.status === 'FAILED') {
                    <span class="cell-secondary reason">{{ describe(row) }}</span>
                  }
                </td>
                <td>{{ row.order.submittedAt | dateTime }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .side {
      font-weight: 600;
    }

    .side-buy {
      color: var(--color-positive);
    }

    .side-sell {
      color: var(--color-negative);
    }

    .reason {
      white-space: normal;
      max-width: 260px;
      margin-top: 4px;
    }
  `,
})
export class OrdersTableComponent {
  readonly rows = input<OrderRow[]>([]);
  readonly loading = input<boolean>(false);
  readonly caption = input<string>('Orders');
  readonly emptyTitle = input<string>('No orders yet');
  readonly emptyMessage = input<string>(
    'Orders you place will appear here with their status and outcome.',
  );
  protected readonly formatOrderId = formatOrderId;

  protected describe(row: OrderRow): string {
    return describeOrderOutcome(row.order);
  }
}
