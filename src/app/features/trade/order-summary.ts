import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CatalogInstrument, OrderType } from '../../core/models/trading.models';
import { formatQuantity } from '../../core/utils/money';
import { MoneyPipe, PricePipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';

export type TradeStep = 'entry' | 'review' | 'result';

export interface OrderSummaryModel {
  instrument: CatalogInstrument | null;
  side: OrderType;
  quantity: number | null;
  price: number | null;
  value: number | null;
  fees: number;
  total: number | null;
}

/** Right-hand order summary: estimates in entry mode, a confirmation in review mode. */
@Component({
  selector: 'app-order-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, PricePipe, IconComponent],
  template: `
    <section
      class="card summary"
      [class.summary-review]="step() === 'review'"
      aria-labelledby="order-summary-title"
    >
      <div class="card-header">
        <div>
          <h2 id="order-summary-title">
            {{ step() === 'review' ? 'Confirm your order' : 'Order summary' }}
          </h2>
          <p class="card-subtitle">
            {{
              step() === 'review'
                ? 'Review the details, then place the order.'
                : 'Estimates update as you type.'
            }}
          </p>
        </div>
      </div>

      <dl class="summary-list">
        <div>
          <dt>Instrument</dt>
          <dd>
            @if (model().instrument; as instrument) {
              {{ instrument.symbol }}
              <span class="text-secondary font-medium">· {{ instrument.instrumentName }}</span>
            } @else {
              <span class="text-muted">Not selected</span>
            }
          </dd>
        </div>
        <div>
          <dt>Order type</dt>
          <dd>
            <span
              [class.text-positive]="model().side === 'BUY'"
              [class.text-negative]="model().side === 'SELL'"
              >{{ model().side === 'BUY' ? 'Buy' : 'Sell' }}</span
            >
            <span class="text-secondary font-medium"> · Market order</span>
          </dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd>{{ quantityLabel() }}</dd>
        </div>
        <div>
          <dt>Estimated execution price</dt>
          <dd>{{ model().price | price: currency() }}</dd>
        </div>
        <div>
          <dt>Estimated transaction value</dt>
          <dd>{{ model().value | money: currency() }}</dd>
        </div>
        <div>
          <dt>Fees</dt>
          <dd><span class="text-secondary font-medium">No commission</span></dd>
        </div>
        <div class="summary-total">
          <dt>Estimated total</dt>
          <dd>{{ model().total | money: currency() }}</dd>
        </div>
      </dl>

      <div class="price-disclosure" role="note" aria-label="Execution price information">
        <app-icon name="info" [size]="18" />
        <p>
          <strong>Market price may change</strong>
          <span
            >The estimated price is not guaranteed. Your order will be priced when it's executed, so
            the final price and total may differ.</span
          >
        </p>
      </div>

      @if (step() === 'entry') {
        @if (errors().length > 0 && showErrors()) {
          <ul class="issue-list" aria-live="polite">
            @for (error of errors(); track error) {
              <li class="field-error"><app-icon name="alert-circle" [size]="16" />{{ error }}</li>
            }
          </ul>
        }
        @for (warning of warnings(); track warning) {
          <div class="alert alert-warning" role="status">
            <app-icon name="alert-triangle" />
            <span>{{ warning }}</span>
          </div>
        }
        <button
          type="button"
          class="btn btn-primary btn-lg btn-block"
          (click)="review.emit()"
          [disabled]="!canReview()"
        >
          Review order
          <app-icon name="arrow-right" [size]="18" />
        </button>
      } @else if (step() === 'review') {
        @if (errors().length > 0) {
          <ul class="issue-list" aria-live="polite">
            @for (error of errors(); track error) {
              <li class="field-error"><app-icon name="alert-circle" [size]="16" />{{ error }}</li>
            }
          </ul>
        }
        @for (warning of warnings(); track warning) {
          <div class="alert alert-warning" role="status">
            <app-icon name="alert-triangle" />
            <span>{{ warning }}</span>
          </div>
        }
        @if (submitError(); as error) {
          <div class="alert alert-error" role="alert">
            <app-icon name="alert-circle" />
            <span>{{ error }}</span>
          </div>
        }
        <div class="review-actions">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="edit.emit()"
            [disabled]="submitting()"
          >
            Edit order
          </button>
          <button
            type="button"
            class="btn btn-lg"
            [class.btn-primary]="model().side === 'BUY'"
            [class.btn-danger]="model().side === 'SELL'"
            (click)="confirm.emit()"
            [disabled]="submitting() || !canReview()"
            [attr.aria-busy]="submitting()"
          >
            @if (submitting()) {
              <span class="spinner" aria-hidden="true"></span>
              Placing order…
            } @else {
              {{ model().side === 'BUY' ? 'Place buy order' : 'Place sell order' }}
            }
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .summary {
      position: sticky;
      top: calc(var(--topbar-height) + 16px);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .summary-review {
      border-color: var(--color-brand);
      box-shadow: 0 0 0 3px var(--color-brand-soft);
    }

    .issue-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .price-disclosure {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    .price-disclosure app-icon {
      flex: 0 0 auto;
      margin-top: 1px;
      color: var(--color-brand);
    }

    .price-disclosure p {
      display: grid;
      gap: 3px;
      margin: 0;
    }

    .price-disclosure strong {
      color: var(--color-text);
      font-weight: 600;
    }

    .review-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .review-actions .btn-lg {
      width: 100%;
    }

    @media (max-width: 1024px) {
      .summary {
        position: static;
      }
    }
  `,
})
export class OrderSummaryComponent {
  readonly model = input.required<OrderSummaryModel>();
  readonly step = input<TradeStep>('entry');
  readonly errors = input<string[]>([]);
  readonly warnings = input<string[]>([]);
  readonly showErrors = input<boolean>(false);
  readonly canReview = input<boolean>(false);
  readonly submitting = input<boolean>(false);
  readonly submitError = input<string | null>(null);

  readonly review = output<void>();
  readonly confirm = output<void>();
  readonly edit = output<void>();

  protected readonly currency = computed(() => this.model().instrument?.currency ?? 'USD');
  protected readonly quantityLabel = computed(() => {
    const quantity = this.model().quantity;
    const instrument = this.model().instrument;
    if (quantity === null || quantity <= 0) {
      return '—';
    }
    const unit =
      instrument?.assetClass.toUpperCase() === 'EQUITY'
        ? quantity === 1
          ? 'share'
          : 'shares'
        : 'units';
    return `${formatQuantity(quantity)} ${unit}`;
  });
}
