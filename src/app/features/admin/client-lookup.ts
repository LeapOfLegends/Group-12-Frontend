import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ClientApiService } from '../../core/api/client-api.service';
import { HoldingsApiService } from '../../core/api/holdings-api.service';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { ClientRecord, Holding, Instrument, Order } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { describeHttpError, httpStatusOf } from '../../core/utils/http-error';
import { buildOrderRows, buildPositions, summarizePortfolio } from '../../core/utils/portfolio-math';
import { MoneyPipe, ShortDatePipe } from '../../shared/pipes/format.pipes';
import { HoldingsTableComponent } from '../../shared/ui/holdings-table/holdings-table';
import { IconComponent } from '../../shared/ui/icon/icon';
import { OrdersTableComponent } from '../../shared/ui/orders-table/orders-table';

interface LookupResult {
  client: ClientRecord;
  holdings: Holding[];
  orders: Order[];
  instruments: Map<number, Instrument>;
}

/** Find one client by ID or email and show their cash, holdings and full order history. */
@Component({
  selector: 'app-client-lookup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, HoldingsTableComponent, OrdersTableComponent, IconComponent, MoneyPipe, ShortDatePipe],
  template: `
    <section class="card" aria-labelledby="client-lookup-title">
      <div class="card-header">
        <div>
          <h3 id="client-lookup-title">Client activity lookup</h3>
          <p class="card-subtitle">Search by client ID or email address.</p>
        </div>
      </div>

      <form class="lookup-form" [formGroup]="form" (ngSubmit)="search()" novalidate>
        <label class="visually-hidden" for="client-lookup-input">Client ID or email</label>
        <div class="input-group lookup-input">
          <span class="input-prefix" aria-hidden="true"><app-icon name="search" [size]="18" /></span>
          <input id="client-lookup-input" class="input" formControlName="query" placeholder="e.g. 42 or jane@example.com" autocomplete="off" />
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="loading() || form.invalid">
          @if (loading()) {
            <span class="spinner" aria-hidden="true"></span>
          }
          Look up
        </button>
      </form>

      @if (error(); as message) {
        <div class="alert alert-error lookup-alert" role="alert">
          <app-icon name="alert-circle" />
          <span>{{ message }}</span>
        </div>
      }

      @if (result(); as found) {
        <div class="lookup-result">
          <div class="client-card">
            <div class="client-identity">
              <span class="avatar" aria-hidden="true">{{ initials() }}</span>
              <div>
                <strong>{{ found.client.firstName }} {{ found.client.lastName }}</strong>
                <span class="text-secondary text-sm">{{ found.client.email }} · Client ID {{ found.client.clientId }}</span>
                <span class="text-secondary text-xs">Member since {{ found.client.createdAt | shortDate }} · {{ found.client.phoneNumber }}</span>
              </div>
            </div>
            <dl class="client-stats">
              <div><dt>Cash balance</dt><dd>{{ found.client.accountBalance | money }}</dd></div>
              <div><dt>Holdings value</dt><dd>{{ summary().holdingsValue | money }}</dd></div>
              <div><dt>Reserved cash</dt><dd>{{ summary().reservedCash | money }}</dd></div>
              <div><dt>Orders</dt><dd>{{ found.orders.length }}</dd></div>
            </dl>
          </div>

          <h4 class="sub-title">Holdings</h4>
          <app-holdings-table [positions]="positions()" [showActions]="false" />

          <h4 class="sub-title">Order history</h4>
          <app-orders-table [rows]="orderRows()" caption="Client order history" emptyTitle="No orders" emptyMessage="This client has not placed any orders." />
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Fills the grid cell so the lookup cards in one row share a height. */
    .card {
      flex: 1;
    }

    .lookup-form {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .lookup-input {
      flex: 1;
      min-width: 220px;
    }

    .lookup-input .input-prefix {
      display: inline-flex;
    }

    .lookup-alert {
      margin-top: var(--space-4);
    }

    .lookup-result {
      margin-top: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .client-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
    }

    .client-identity {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .client-identity div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--color-brand-soft);
      color: var(--color-on-brand-soft);
      font-weight: 700;
      flex: none;
    }

    .client-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 0;
    }

    .client-stats div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .client-stats dt {
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    .client-stats dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .sub-title {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    @media (max-width: 640px) {
      .client-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class ClientLookupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly clientApi = inject(ClientApiService);
  private readonly holdingsApi = inject(HoldingsApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalog = inject(InstrumentCatalogService);

  protected readonly form = this.fb.nonNullable.group({ query: ['', [Validators.required, Validators.maxLength(255)]] });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<LookupResult | null>(null);

  protected readonly positions = computed(() => {
    const found = this.result();
    return found ? buildPositions(found.holdings, found.instruments) : [];
  });
  protected readonly orderRows = computed(() => {
    const found = this.result();
    return found ? buildOrderRows(found.orders, found.instruments) : [];
  });
  protected readonly summary = computed(() => {
    const found = this.result();
    return summarizePortfolio(found?.client.accountBalance ?? 0, this.positions(), found?.orders ?? []);
  });
  protected readonly initials = computed(() => {
    const client = this.result()?.client;
    return client ? `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase() : '';
  });

  protected async search(): Promise<void> {
    const query = this.form.controls.query.value.trim();
    if (!query || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    try {
      const client = /^\d+$/.test(query)
        ? await firstValueFrom(this.clientApi.getClient(Number(query)))
        : await firstValueFrom(this.clientApi.getClientByEmail(query));
      const { holdings, orders } = await firstValueFrom(
        forkJoin({ holdings: this.holdingsApi.listForClient(client.clientId), orders: this.ordersApi.listForClient(client.clientId) }),
      );
      const instruments = await firstValueFrom(
        this.catalog.getMany([...holdings.map((holding) => holding.instrumentId), ...orders.map((order) => order.instrumentId)]),
      );
      this.result.set({ client, holdings, orders, instruments });
    } catch (error: unknown) {
      this.error.set(
        httpStatusOf(error) === 404 ? `No client matches “${query}”.` : describeHttpError(error, 'The client could not be loaded.'),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
