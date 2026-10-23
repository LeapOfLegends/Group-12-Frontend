import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ClientRecord } from '../../core/models/trading.models';
import { formatMoney } from '../../core/utils/money';
import { MoneyPipe, ShortDatePipe } from '../../shared/pipes/format.pipes';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';

type SortKey = 'balance' | 'name' | 'created';

const PAGE_SIZE = 25;

/** Searchable, sortable table of client cash balances with summary figures. */
@Component({
  selector: 'app-cash-positions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, ShortDatePipe, EmptyStateComponent, IconComponent, LoadingSkeletonComponent],
  template: `
    <section class="card" aria-labelledby="cash-positions-title">
      <div class="card-header">
        <div>
          <h3 id="cash-positions-title">Client cash positions</h3>
          @if (!loading() && !error()) {
            <p class="card-subtitle">{{ clients().length }} clients · total cash {{ totalCash() | money }} · average {{ averageCash() | money }}</p>
          }
        </div>
        <div class="controls">
          <label class="visually-hidden" for="cash-search">Search clients</label>
          <div class="input-group search">
            <span class="input-prefix" aria-hidden="true"><app-icon name="search" [size]="18" /></span>
            <input id="cash-search" class="input" type="search" placeholder="Search name or email" [value]="query()" (input)="query.set($any($event.target).value)" />
          </div>
          <label class="visually-hidden" for="cash-sort">Sort by</label>
          <select id="cash-sort" class="select" [value]="sort()" (change)="sort.set($any($event.target).value)">
            <option value="balance">Highest balance</option>
            <option value="name">Name A–Z</option>
            <option value="created">Newest clients</option>
          </select>
        </div>
      </div>

      @if (error(); as message) {
        <div class="alert alert-error" role="alert">
          <app-icon name="alert-circle" />
          <span>{{ message }}</span>
          <button type="button" class="btn btn-sm btn-secondary alert-action" (click)="retry.emit()">Retry</button>
        </div>
      } @else if (loading() && clients().length === 0) {
        <app-loading-skeleton variant="table" [lines]="6" label="Loading client balances" />
      } @else if (clients().length === 0) {
        <app-empty-state icon="users" title="No client cash positions" message="No client accounts have been returned." />
      } @else if (visible().length === 0) {
        <app-empty-state icon="users" title="No clients match" message="Try a different name or email address." />
      } @else {
        <div class="table-wrap">
          <table class="table">
            <caption class="visually-hidden">Client cash positions</caption>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Email</th>
                <th scope="col">Joined</th>
                <th scope="col" class="num">Cash balance</th>
                <th scope="col" class="num">Share of total</th>
              </tr>
            </thead>
            <tbody>
              @for (client of visible(); track client.clientId) {
                <tr>
                  <td>
                    <span class="cell-primary">{{ client.firstName }} {{ client.lastName }}</span>
                    <span class="cell-secondary">ID {{ client.clientId }}</span>
                  </td>
                  <td>{{ client.email }}</td>
                  <td>{{ client.createdAt | shortDate }}</td>
                  <td class="num cell-primary">{{ client.accountBalance | money }}</td>
                  <td class="num">{{ share(client) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span class="text-secondary text-sm">Showing {{ visible().length }} of {{ filtered().length }}</span>
          @if (visible().length < filtered().length) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="limit.set(limit() + pageSize)">Show more</button>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .controls {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .search {
      min-width: 220px;
    }

    .search .input-prefix {
      display: inline-flex;
    }

    .select {
      width: auto;
      min-width: 170px;
    }

    .table-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-top: var(--space-3);
    }
  `,
})
export class CashPositionsComponent {
  readonly clients = input<ClientRecord[]>([]);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly retry = output<void>();

  protected readonly pageSize = PAGE_SIZE;
  protected readonly query = signal('');
  protected readonly sort = signal<SortKey>('balance');
  protected readonly limit = signal(PAGE_SIZE);

  protected readonly totalCash = computed(() => this.clients().reduce((sum, client) => sum + client.accountBalance, 0));
  protected readonly averageCash = computed(() => (this.clients().length ? this.totalCash() / this.clients().length : 0));

  protected readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    const matches = term
      ? this.clients().filter((client) => `${client.firstName} ${client.lastName}`.toLowerCase().includes(term) || client.email.toLowerCase().includes(term))
      : [...this.clients()];
    switch (this.sort()) {
      case 'name':
        return matches.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
      case 'created':
        return matches.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      default:
        return matches.sort((a, b) => b.accountBalance - a.accountBalance);
    }
  });

  protected readonly visible = computed(() => this.filtered().slice(0, this.limit()));

  protected share(client: ClientRecord): string {
    const total = this.totalCash();
    if (total <= 0) {
      return '—';
    }
    return `${((client.accountBalance / total) * 100).toFixed(2)}%`;
  }

  protected format(value: number): string {
    return formatMoney(value);
  }
}
