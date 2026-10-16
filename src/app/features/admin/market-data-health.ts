import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CatalogInstrument } from '../../core/models/trading.models';
import { ageInSeconds, formatRelativeAge } from '../../core/utils/dates';
import { formatInteger } from '../../core/utils/money';
import { BarListComponent } from '../../shared/charts/bar-list/bar-list';
import { PricePipe } from '../../shared/pipes/format.pipes';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { BadgeTone, StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';

type QuoteState = 'fresh' | 'stale' | 'missing';
type Filter = 'all' | QuoteState | 'untradable';

interface InstrumentRow {
  instrument: CatalogInstrument;
  state: QuoteState;
  age: number | null;
}

const STATE_LABEL: Record<QuoteState, { label: string; tone: BadgeTone; icon: string }> = {
  fresh: { label: 'Fresh quote', tone: 'positive', icon: 'check' },
  stale: { label: 'Stale quote', tone: 'warning', icon: 'clock' },
  missing: { label: 'No quote', tone: 'negative', icon: 'alert-circle' },
};

/** Operational view of the stored market data: which instruments can actually be priced right now. */
@Component({
  selector: 'app-market-data-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarListComponent, PricePipe, EmptyStateComponent, LoadingSkeletonComponent, StatusBadgeComponent],
  template: `
    <section class="card" aria-labelledby="market-data-title">
      <div class="card-header">
        <div>
          <h3 id="market-data-title">Market data health</h3>
          <p class="card-subtitle">
            Orders are priced only against quotes under {{ maxAge }}s old. {{ counts().fresh }} fresh · {{ counts().stale }} stale · {{ counts().missing }} without a quote.
          </p>
        </div>
        <div class="segmented" role="group" aria-label="Filter instruments">
          @for (option of filters; track option.value) {
            <button type="button" [attr.aria-pressed]="filter() === option.value" (click)="filter.set(option.value)">{{ option.label }}</button>
          }
        </div>
      </div>

      @if (loading()) {
        <app-loading-skeleton variant="table" [lines]="6" label="Loading market data" />
      } @else if (instruments().length === 0) {
        <app-empty-state icon="activity" title="No instruments loaded" message="The instrument list could not be retrieved from the trading API." />
      } @else {
        <div class="health-layout">
          <aside class="health-side">
            <h4 class="side-title">Instruments by asset class</h4>
            <app-bar-list [items]="byAssetClass()" [formatter]="countFormatter" ariaLabel="Instruments by asset class" />
          </aside>
          <div class="table-wrap health-table">
            <table class="table">
              <caption class="visually-hidden">Instrument market data status</caption>
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  <th scope="col">Class</th>
                  <th scope="col" class="num">Bid</th>
                  <th scope="col" class="num">Ask</th>
                  <th scope="col" class="num">Last</th>
                  <th scope="col">Quote age</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (row of visible(); track row.instrument.instrumentId) {
                  <tr>
                    <td>
                      <span class="cell-primary">{{ row.instrument.symbol }}</span>
                      <span class="cell-secondary">{{ row.instrument.instrumentName }}</span>
                    </td>
                    <td>{{ row.instrument.assetClass }} · {{ row.instrument.currency }}</td>
                    <td class="num">{{ row.instrument.bidPrice | price: row.instrument.currency }}</td>
                    <td class="num">{{ row.instrument.askPrice | price: row.instrument.currency }}</td>
                    <td class="num">{{ row.instrument.lastPrice | price: row.instrument.currency }}</td>
                    <td>{{ ageLabel(row) }}</td>
                    <td>
                      <div class="cluster status-cluster">
                        <app-status-badge [tone]="stateMeta(row.state).tone" [icon]="stateMeta(row.state).icon" [label]="stateMeta(row.state).label" />
                        @if (!row.instrument.tradable) {
                          <app-status-badge tone="neutral" icon="lock" label="Not tradable" />
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <p class="text-secondary text-xs health-footer">Showing {{ visible().length }} of {{ rows().length }} instruments.</p>
      }
    </section>
  `,
  styles: `
    .health-layout {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .health-side {
      max-width: 520px;
    }

    .health-table {
      max-height: 480px;
      overflow: auto;
      border: 1px solid var(--color-border);
    }

    .side-title {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }

    .status-cluster {
      gap: 6px;
      flex-wrap: nowrap;
    }

    .health-footer {
      margin-top: var(--space-3);
    }
  `,
})
export class MarketDataHealthComponent {
  readonly instruments = input<CatalogInstrument[]>([]);
  readonly loading = input<boolean>(false);
  readonly now = input<number>(Date.now());

  protected readonly maxAge = environment.quoteMaxAgeSeconds;
  protected readonly filter = signal<Filter>('all');
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'fresh', label: 'Fresh' },
    { value: 'stale', label: 'Stale' },
    { value: 'missing', label: 'No quote' },
    { value: 'untradable', label: 'Not tradable' },
  ];

  protected readonly rows = computed<InstrumentRow[]>(() =>
    this.instruments().map((instrument) => {
      const age = ageInSeconds(instrument.quoteAsOf, this.now());
      const state: QuoteState = age === null ? 'missing' : age <= this.maxAge ? 'fresh' : 'stale';
      return { instrument, state, age };
    }),
  );

  protected readonly counts = computed(() => ({
    fresh: this.rows().filter((row) => row.state === 'fresh').length,
    stale: this.rows().filter((row) => row.state === 'stale').length,
    missing: this.rows().filter((row) => row.state === 'missing').length,
  }));

  protected readonly visible = computed(() => {
    const filter = this.filter();
    return this.rows().filter((row) => {
      if (filter === 'all') {
        return true;
      }
      if (filter === 'untradable') {
        return !row.instrument.tradable;
      }
      return row.state === filter;
    });
  });

  protected readonly byAssetClass = computed(() => {
    const totals = new Map<string, number>();
    for (const instrument of this.instruments()) {
      const label = instrument.assetClass || 'Other';
      totals.set(label, (totals.get(label) ?? 0) + 1);
    }
    const total = this.instruments().length || 1;
    return [...totals.entries()].map(([label, value]) => ({ label, value, share: value / total })).sort((a, b) => b.value - a.value);
  });

  protected readonly countFormatter = (value: number): string => formatInteger(value);

  protected stateMeta(state: QuoteState) {
    return STATE_LABEL[state];
  }

  protected ageLabel(row: InstrumentRow): string {
    return row.instrument.quoteAsOf ? formatRelativeAge(row.instrument.quoteAsOf, this.now()) : '—';
  }
}
