import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { Instrument, Order } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { describeHttpError, httpStatusOf } from '../../core/utils/http-error';
import { describeOrderOutcome } from '../../core/utils/order-reasons';
import { DateTimePipe, MoneyPipe, PricePipe, QuantityPipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';

/** Reconstruct one order's lifecycle (placed, accepted, priced, filled or rejected) from its record. */
@Component({
  selector: 'app-order-lookup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, StatusBadgeComponent, MoneyPipe, PricePipe, QuantityPipe, DateTimePipe],
  template: `
    <section class="card" aria-labelledby="order-lookup-title">
      <div class="card-header">
        <div>
          <h3 id="order-lookup-title">Order lookup</h3>
          <p class="card-subtitle">Trace an order by its ID.</p>
        </div>
      </div>

      <form class="lookup-form" [formGroup]="form" (ngSubmit)="search()" novalidate>
        <label class="visually-hidden" for="order-lookup-input">Order ID</label>
        <input id="order-lookup-input" class="input" formControlName="orderId" inputmode="numeric" placeholder="Order ID, e.g. 47" autocomplete="off" />
        <button type="submit" class="btn btn-primary" [disabled]="loading() || form.invalid">
          @if (loading()) {
            <span class="spinner" aria-hidden="true"></span>
          }
          Trace
        </button>
      </form>

      @if (error(); as message) {
        <div class="alert alert-error lookup-alert" role="alert">
          <app-icon name="alert-circle" />
          <span>{{ message }}</span>
        </div>
      }

      @if (order(); as found) {
        <div class="order-result">
          <div class="spread">
            <strong>Order #{{ found.orderId }}</strong>
            <app-status-badge [status]="found.status" />
          </div>
          <p class="text-secondary text-sm">{{ outcome(found) }}</p>
          <dl class="summary-list compact">
            <div><dt>Client</dt><dd>ID {{ found.clientId }}</dd></div>
            <div>
              <dt>Instrument</dt>
              <dd>{{ instrument()?.symbol ?? '#' + found.instrumentId }}</dd>
            </div>
            <div><dt>Side / quantity</dt><dd>{{ found.orderType }} {{ found.quantity | quantity }}</dd></div>
            <div><dt>Submitted</dt><dd>{{ found.submittedAt | dateTime }}</dd></div>
            @if (found.acceptedAt) {
              <div><dt>Accepted</dt><dd>{{ found.acceptedAt | dateTime }}</dd></div>
            }
            @if (found.reservedCash !== null) {
              <div><dt>Reserved cash</dt><dd>{{ found.reservedCash | money }}</dd></div>
            }
            @if (found.rejectedAt) {
              <div><dt>Rejected</dt><dd>{{ found.rejectedAt | dateTime }}</dd></div>
            }
            @if (found.failedAt) {
              <div><dt>Failed</dt><dd>{{ found.failedAt | dateTime }}</dd></div>
            }
            @if (found.filledAt) {
              <div><dt>Filled</dt><dd>{{ found.filledAt | dateTime }}</dd></div>
            }
            @if (found.executionPrice !== null) {
              <div><dt>Execution price</dt><dd>{{ found.executionPrice | price }}</dd></div>
            }
            @if (found.executionQuoteAsOf) {
              <div><dt>Quote used</dt><dd>{{ found.executionQuoteAsOf | dateTime }}</dd></div>
            }
            @if (found.tradeValue !== null) {
              <div class="summary-total"><dt>Trade value</dt><dd>{{ found.tradeValue | money }}</dd></div>
            }
            @if (found.rejectionReason) {
              <div><dt>Rejection reason</dt><dd>{{ found.rejectionReason }}</dd></div>
            }
            @if (found.failureReason) {
              <div><dt>Failure reason</dt><dd>{{ found.failureReason }}</dd></div>
            }
          </dl>
        </div>
      }
    </section>
  `,
  styles: `
    .lookup-form {
      display: flex;
      gap: 10px;
    }

    .lookup-form .input {
      flex: 1;
      min-width: 0;
    }

    .lookup-alert,
    .order-result {
      margin-top: var(--space-4);
    }

    .order-result {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .compact > div {
      padding: 8px 0;
    }
  `,
})
export class OrderLookupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalog = inject(InstrumentCatalogService);

  protected readonly form = this.fb.nonNullable.group({ orderId: ['', [Validators.required, Validators.pattern(/^\d+$/)]] });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly order = signal<Order | null>(null);
  protected readonly instrument = signal<Instrument | null>(null);

  protected outcome(order: Order): string {
    return describeOrderOutcome(order);
  }

  protected async search(): Promise<void> {
    const id = Number(this.form.controls.orderId.value);
    if (!Number.isInteger(id) || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.order.set(null);
    this.instrument.set(null);
    try {
      const order = await firstValueFrom(this.ordersApi.getOrder(id));
      this.order.set(order);
      this.instrument.set(await firstValueFrom(this.catalog.getById(order.instrumentId)));
    } catch (error: unknown) {
      this.error.set(httpStatusOf(error) === 404 ? `No order with ID ${id}.` : describeHttpError(error, 'The order could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }
}
