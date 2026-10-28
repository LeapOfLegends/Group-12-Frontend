import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SeriesPoint } from '../../../core/models/portfolio.models';
import {
  AccountTransaction,
  INSTRUMENT_HISTORY_RANGES,
  PortfolioPerformanceHistory,
  PortfolioPerformancePoint,
  PortfolioPerformanceRange,
} from '../../../core/models/trading.models';
import { formatDateTime } from '../../../core/utils/dates';
import {
  formatCompactMoney,
  formatMoney,
  formatPercentagePoints,
  formatSignedMoney,
} from '../../../core/utils/money';
import { DateTimePipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state';
import { IconComponent } from '../../ui/icon/icon';
import { LoadingSkeletonComponent } from '../../ui/loading-skeleton/loading-skeleton';
import { ChartTone, LineChartComponent } from '../line-chart/line-chart';
import { buildChartXAxis } from '../chart-axis';

/** Controlled dashboard presentation for backend-provided portfolio performance. */
@Component({
  selector: 'app-portfolio-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LineChartComponent,
    EmptyStateComponent,
    IconComponent,
    LoadingSkeletonComponent,
    DateTimePipe,
  ],
  template: `
    <section class="card chart-card" aria-labelledby="portfolio-chart-title">
      <div class="card-header">
        <div>
          <h2 id="portfolio-chart-title">{{ title() }}</h2>
          <p class="card-subtitle">Cash plus the market value of your investments</p>
        </div>
        <div class="chart-controls">
          <div class="segmented" role="group" aria-label="Time range">
            @for (item of ranges; track item) {
              <button
                type="button"
                [attr.data-range]="item"
                [attr.aria-pressed]="range() === item"
                (click)="selectRange(item)"
              >
                {{ item }}
              </button>
            }
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="showTable.set(!showTable())"
            [attr.aria-pressed]="showTable()"
            [disabled]="series().length === 0"
          >
            <app-icon name="table" [size]="16" />
            {{ showTable() ? 'Hide table' : 'Show table' }}
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="chart-fill" [style.min-height.px]="height()">
          <app-loading-skeleton
            variant="chart"
            [height]="height()"
            label="Loading portfolio history"
          />
        </div>
      } @else if (error()) {
        <div class="chart-fill chart-fill-center" [style.min-height.px]="height()">
          <app-empty-state
            icon="alert-circle"
            title="Portfolio history unavailable"
            [message]="error()!"
          >
            <button type="button" class="btn btn-secondary btn-sm" (click)="retry.emit()">
              Try again
            </button>
          </app-empty-state>
        </div>
      } @else if (!history() || history()!.points.length === 0) {
        <div class="chart-fill chart-fill-center" [style.min-height.px]="height()">
          <app-empty-state
            icon="chart-line"
            title="No portfolio history yet"
            message="Historical valuations will appear after your account has activity."
          />
        </div>
      } @else if (series().length === 0) {
        <div class="chart-fill chart-fill-center" [style.min-height.px]="height()">
          <app-empty-state
            icon="chart-line"
            title="No reliable valuations"
            message="No reliable portfolio valuations are available for this range."
          />
        </div>
      } @else {
        <div class="chart-summary">
          <span class="chart-current">{{ formatValue(latestValue()) }}</span>
          <div class="return-summary" aria-label="Selected range gain or loss and return">
            <span
              class="delta"
              [class.delta-up]="periodGainTone() === 'positive'"
              [class.delta-down]="periodGainTone() === 'negative'"
              [class.delta-flat]="periodGainTone() === 'neutral'"
            >
              @if (formattedPeriodGain(); as gainText) {
                {{ gainText }}
              } @else {
                Period gain/loss unavailable
              }
            </span>
            <span
              class="delta"
              [class.delta-up]="twrTone() === 'positive'"
              [class.delta-down]="twrTone() === 'negative'"
              [class.delta-flat]="twrTone() === 'neutral'"
            >
              @if (formattedTwr(); as returnText) {
                ({{ returnText }})
              } @else {
                (TWR unavailable)
              }
            </span>
          </div>
        </div>

        @if (series().length >= 2) {
          <app-line-chart
            class="chart-plot"
            [style.min-height.px]="height()"
            [points]="series()"
            [tone]="tone()"
            [height]="height()"
            [fill]="true"
            [xScale]="xAxis().scale"
            [xTickValues]="xAxis().tickValues"
            [xDomain]="xAxis().domain"
            [xTickFormatter]="xAxis().tickFormatter"
            [tooltipTimeFormatter]="xAxis().tooltipFormatter"
            [valueFormatter]="formatValue"
            [compactFormatter]="formatCompactValue"
            ariaLabel="Historical portfolio value including cash and holdings"
          />
        } @else {
          <p class="single-point text-secondary" role="status">
            Only one reliable observation is available for this range.
          </p>
        }

        @if (coverage(); as coverageText) {
          <p class="chart-caption text-secondary text-xs">Available coverage: {{ coverageText }}</p>
        }
        @if (history()!.partial || history()!.unavailablePointCount > 0) {
          <p class="chart-notice text-secondary text-xs" role="status">
            Some historical valuations are unavailable. Gaps are not estimated.
            @if (history()!.unavailablePointCount > 0) {
              ({{ history()!.unavailablePointCount }} unavailable
              {{ history()!.unavailablePointCount === 1 ? 'point' : 'points' }}.)
            }
          </p>
        }
        @if (history()!.returnMethod === 'ESTIMATED_TWR') {
          <p class="chart-notice text-secondary text-xs" role="status">
            Estimated using available historical closing prices.
          </p>
        }
        @if (history()!.returnMethod === 'UNAVAILABLE') {
          <p class="chart-notice text-secondary text-xs" role="status">
            The backend could not calculate a reliable time-weighted return for this range.
          </p>
        }
        @for (limitation of history()!.limitations; track limitation) {
          <p class="chart-notice text-secondary text-xs">{{ limitation }}</p>
        }

        @if (showTable()) {
          <div class="table-wrap chart-table">
            <table class="table">
              <caption class="visually-hidden">
                {{
                  title()
                }}
                data points
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" class="num">Portfolio value</th>
                  <th scope="col">Valuation details</th>
                </tr>
              </thead>
              <tbody>
                @for (point of series(); track point.time) {
                  <tr>
                    <td>{{ point.time | dateTime }}</td>
                    <td class="num">{{ formatValue(point.value) }}</td>
                    <td>{{ point.note ?? '' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .chart-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chart-plot,
    .chart-fill {
      flex: 1 1 0;
    }
    .chart-fill-center {
      display: grid;
      place-items: center;
    }
    .chart-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chart-summary {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      margin-bottom: 6px;
    }
    .return-summary {
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chart-current {
      font-size: var(--text-2xl);
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .chart-caption,
    .chart-notice {
      margin-top: 4px;
    }
    .single-point {
      min-height: 120px;
      display: grid;
      place-items: center;
      text-align: center;
    }
    .chart-table {
      margin-top: 12px;
      max-height: 280px;
      overflow: auto;
      border: 1px solid var(--color-border);
    }
    @media (max-width: 480px) {
      .return-separator {
        display: none;
      }
      .return-summary {
        flex-direction: column;
        gap: 2px;
      }
    }
  `,
})
export class PortfolioChartComponent {
  readonly title = input('Portfolio performance');
  readonly history = input<PortfolioPerformanceHistory | null>(null);
  readonly range = input.required<PortfolioPerformanceRange>();
  readonly transactions = input<readonly AccountTransaction[]>([]);
  readonly transactionHistoryAvailable = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly height = input(280);
  readonly rangeChange = output<PortfolioPerformanceRange>();
  readonly retry = output<void>();

  protected readonly ranges = INSTRUMENT_HISTORY_RANGES;
  protected readonly showTable = signal(false);

  protected readonly series = computed<SeriesPoint[]>(() => {
    const history = this.history();
    if (!history) return [];
    let gapPending = false;
    const points: SeriesPoint[] = [];
    const sorted = [...history.points].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    for (const point of sorted) {
      const time = Date.parse(point.timestamp);
      const value = point.totalValue;
      if (
        !Number.isFinite(time) ||
        value === null ||
        !Number.isFinite(value) ||
        point.valuationStatus === 'UNAVAILABLE'
      ) {
        gapPending = points.length > 0;
        continue;
      }
      points.push({
        time,
        value,
        note: pointNote(point, history.currency),
        ...(gapPending ? { breakBefore: true } : {}),
      });
      gapPending = false;
    }
    return points;
  });

  protected readonly latestValue = computed(() => this.series().at(-1)?.value ?? 0);
  protected readonly latestTwr = computed(() => {
    const history = this.history();
    if (!history || history.returnMethod === 'UNAVAILABLE') return null;
    return (
      [...history.points]
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .find(
          (point) =>
            Number.isFinite(Date.parse(point.timestamp)) &&
            point.valuationStatus !== 'UNAVAILABLE' &&
            point.cumulativeReturnPercent !== null &&
            Number.isFinite(point.cumulativeReturnPercent),
        )?.cumulativeReturnPercent ?? null
    );
  });
  protected readonly periodGain = computed(() => {
    if (!this.transactionHistoryAvailable()) return null;
    const points = this.series();
    if (points.length < 2) return null;
    const start = points[0];
    const end = points.at(-1)!;
    if (start.time >= end.time) return null;

    const externalFlows = this.transactions().filter((transaction) => {
      const type = transaction.transactionType.toUpperCase();
      return type === 'DEPOSIT' || type === 'WITHDRAWAL';
    });
    if (
      externalFlows.some(
        (transaction) =>
          !Number.isFinite(Date.parse(transaction.createdAt)) ||
          !Number.isFinite(transaction.amount),
      )
    ) {
      return null;
    }
    const netExternalFlows = externalFlows.reduce((total, transaction) => {
      const time = Date.parse(transaction.createdAt);
      return time > start.time && time <= end.time ? total + transaction.amount : total;
    }, 0);
    const result = end.value - start.value - netExternalFlows;
    return Number.isFinite(result) ? result : null;
  });
  protected readonly formattedTwr = computed(() => {
    const value = this.latestTwr();
    return value === null ? '' : formatPercentagePoints(value, { signed: true });
  });
  protected readonly formattedPeriodGain = computed(() => {
    const value = this.periodGain();
    return value === null ? '' : formatSignedMoney(value, this.history()?.currency || 'USD');
  });
  protected readonly xAxis = computed(() =>
    buildChartXAxis(this.series(), this.range(), { assetClass: 'PORTFOLIO' }),
  );
  protected readonly tone = computed<ChartTone>(() => {
    const points = this.series();
    const change = points.length >= 2 ? points[points.length - 1].value - points[0].value : 0;
    return change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
  });
  protected readonly twrTone = computed<ChartTone>(() => toneOf(this.latestTwr()));
  protected readonly periodGainTone = computed<ChartTone>(() => toneOf(this.periodGain()));
  protected readonly coverage = computed(() => {
    const history = this.history();
    if (!history?.availableFrom || !history.availableTo) return '';
    const from = Date.parse(history.availableFrom);
    const to = Date.parse(history.availableTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
    return `${formatDateTime(from)} to ${formatDateTime(to)}`;
  });

  protected readonly formatValue = (value: number): string =>
    formatMoney(value, this.history()?.currency || 'USD');

  protected readonly formatCompactValue = (value: number): string =>
    formatCompactMoney(value, this.history()?.currency || 'USD');

  protected selectRange(range: PortfolioPerformanceRange): void {
    if (range !== this.range()) this.rangeChange.emit(range);
  }
}

function toneOf(value: number | null): ChartTone {
  return value === null || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative';
}

function pointNote(point: PortfolioPerformancePoint, currency: string): string {
  const values = `Cash ${formatMoney(point.cashValue, currency)}; holdings ${formatMoney(point.holdingsValue, currency)}.`;
  const status =
    point.valuationStatus === 'CARRIED_FORWARD'
      ? ' '
      : '';
  return `${values}${status}`;
}
