import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SeriesPoint } from '../../../core/models/portfolio.models';
import {
  INSTRUMENT_HISTORY_RANGES,
  PortfolioPerformanceHistory,
  PortfolioPerformancePoint,
  PortfolioPerformanceRange,
} from '../../../core/models/trading.models';
import { formatDateTime } from '../../../core/utils/dates';
import { formatCompactMoney, formatMoney, formatPercentagePoints } from '../../../core/utils/money';
import { DateTimePipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state';
import { IconComponent } from '../../ui/icon/icon';
import { LoadingSkeletonComponent } from '../../ui/loading-skeleton/loading-skeleton';
import { ChartTone, LineChartComponent } from '../line-chart/line-chart';

export type PortfolioChartMetric = 'VALUE' | 'TWR';

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
          <p class="card-subtitle">
            {{
              metric() === 'VALUE'
                ? 'Cash plus the market value of your investments'
                : 'Time-weighted return'
            }}
          </p>
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

      <div class="metric-selector segmented" role="group" aria-label="Performance metric">
        <button
          type="button"
          data-metric="VALUE"
          [attr.aria-pressed]="metric() === 'VALUE'"
          (click)="selectMetric('VALUE')"
        >
          Portfolio Value
        </button>
        <button
          type="button"
          data-metric="TWR"
          [attr.aria-pressed]="metric() === 'TWR'"
          (click)="selectMetric('TWR')"
        >
          Time-Weighted Return
        </button>
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
            [title]="
              metric() === 'TWR' ? 'Time-weighted return unavailable' : 'No reliable valuations'
            "
            [message]="
              metric() === 'TWR'
                ? 'A reliable return could not be calculated for this range.'
                : 'No reliable portfolio valuations are available for this range.'
            "
          />
        </div>
      } @else {
        <div class="chart-summary">
          <span class="chart-current">{{ formatValue(latestValue()) }}</span>
          <span
            class="delta"
            [class.delta-up]="tone() === 'positive'"
            [class.delta-down]="tone() === 'negative'"
            [class.delta-flat]="tone() === 'neutral'"
          >
            {{ metric() === 'TWR' ? 'Cumulative return' : 'Latest historical value' }}
          </span>
        </div>

        @if (series().length >= 2) {
          <app-line-chart
            class="chart-plot"
            [style.min-height.px]="height()"
            [points]="series()"
            [tone]="tone()"
            [height]="height()"
            [fill]="true"
            [valueFormatter]="formatValue"
            [compactFormatter]="formatCompactValue"
            [ariaLabel]="
              metric() === 'VALUE'
                ? 'Historical portfolio value including cash and holdings'
                : 'Historical time-weighted portfolio return'
            "
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
        @if (metric() === 'TWR' && history()!.returnMethod === 'ESTIMATED_TWR') {
          <p class="chart-notice text-secondary text-xs" role="status">
            Estimated using available historical closing prices.
          </p>
        }
        @if (metric() === 'TWR' && history()!.returnMethod === 'UNAVAILABLE') {
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
                  <th scope="col" class="num">
                    {{ metric() === 'VALUE' ? 'Portfolio value' : 'Time-weighted return' }}
                  </th>
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
    .chart-controls,
    .chart-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .metric-selector {
      align-self: flex-start;
    }
    .chart-summary {
      align-items: baseline;
      gap: 14px;
      margin-bottom: 6px;
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
  `,
})
export class PortfolioChartComponent {
  readonly title = input('Portfolio performance');
  readonly history = input<PortfolioPerformanceHistory | null>(null);
  readonly range = input.required<PortfolioPerformanceRange>();
  readonly metric = input.required<PortfolioChartMetric>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly height = input(280);
  readonly rangeChange = output<PortfolioPerformanceRange>();
  readonly metricChange = output<PortfolioChartMetric>();
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
      const value = this.metric() === 'VALUE' ? point.totalValue : point.cumulativeReturnPercent;
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
  protected readonly tone = computed<ChartTone>(() => {
    const points = this.series();
    const change =
      this.metric() === 'TWR'
        ? (points.at(-1)?.value ?? 0)
        : points.length >= 2
          ? points[points.length - 1].value - points[0].value
          : 0;
    return change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
  });
  protected readonly coverage = computed(() => {
    const history = this.history();
    if (!history?.availableFrom || !history.availableTo) return '';
    const from = Date.parse(history.availableFrom);
    const to = Date.parse(history.availableTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
    return `${formatDateTime(from)} to ${formatDateTime(to)}`;
  });

  protected readonly formatValue = (value: number): string =>
    this.metric() === 'VALUE'
      ? formatMoney(value, this.history()?.currency || 'USD')
      : formatPercentagePoints(value, { signed: true });

  protected readonly formatCompactValue = (value: number): string =>
    this.metric() === 'VALUE'
      ? formatCompactMoney(value, this.history()?.currency || 'USD')
      : formatPercentagePoints(value);

  protected selectRange(range: PortfolioPerformanceRange): void {
    if (range !== this.range()) this.rangeChange.emit(range);
  }

  protected selectMetric(metric: PortfolioChartMetric): void {
    if (metric !== this.metric()) this.metricChange.emit(metric);
  }
}

function pointNote(point: PortfolioPerformancePoint, currency: string): string {
  const values = `Cash ${formatMoney(point.cashValue, currency)}; holdings ${formatMoney(point.holdingsValue, currency)}.`;
  const status =
    point.valuationStatus === 'CARRIED_FORWARD'
      ? ' Carried forward using the last available completed market price.'
      : '';
  return `${values}${status}`;
}
