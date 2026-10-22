import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { CHART_RANGES, ChartRange, SeriesPoint } from '../../../core/models/portfolio.models';
import { formatCompactMoney, formatMoney } from '../../../core/utils/money';
import { rangeHasData, sliceSeries } from '../../../core/utils/portfolio-math';
import { DateTimePipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state';
import { IconComponent } from '../../ui/icon/icon';
import { LoadingSkeletonComponent } from '../../ui/loading-skeleton/loading-skeleton';
import { ChartTone, LineChartComponent } from '../line-chart/line-chart';

/**
 * Dashboard chart card: time-range presets (only ranges that contain real data are
 * enabled), the line chart, and a table view so every value is readable without
 * hovering. The card fills the height its grid cell gives it (so it matches the card
 * beside it) and the plot grows into that space; `height` is the plot's minimum.
 */
@Component({
  selector: 'app-portfolio-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChartComponent, EmptyStateComponent, IconComponent, LoadingSkeletonComponent, DateTimePipe],
  template: `
    <section class="card chart-card" aria-labelledby="portfolio-chart-title">
      <div class="card-header">
        <div>
          <h2 id="portfolio-chart-title">{{ title() }}</h2>
          <p class="card-subtitle">{{ subtitle() }}</p>
        </div>
        <div class="chart-controls">
          <div class="segmented" role="group" aria-label="Time range">
            @for (range of ranges; track range) {
              <button
                type="button"
                [attr.aria-pressed]="selectedRange() === range"
                [disabled]="!availability()[range]"
                [attr.title]="availability()[range] ? null : 'No activity in this range'"
                (click)="selectedRange.set(range)"
              >
                {{ range }}
              </button>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()" [disabled]="series().length === 0">
            <app-icon name="table" [size]="16" />
            {{ showTable() ? 'Hide table' : 'Show table' }}
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="chart-fill" [style.min-height.px]="height()">
          <app-loading-skeleton variant="chart" [height]="height()" label="Loading chart" />
        </div>
      } @else if (series().length === 0) {
        <div class="chart-fill chart-fill-center" [style.min-height.px]="height()">
          <app-empty-state icon="chart-line" [title]="emptyTitle()" [message]="emptyMessage()" />
        </div>
      } @else {
        @if (visible().length >= 2) {
          <div class="chart-summary">
            <span class="chart-current">{{ format(latestValue()) }}</span>
            @if (changeInRange() !== null) {
              @if (deltaColoring()) {
                <span class="delta" [class.delta-up]="changeInRange()! > 0" [class.delta-down]="changeInRange()! < 0" [class.delta-flat]="changeInRange() === 0">
                  @if (changeInRange()! > 0) {
                    <app-icon name="trend-up" [size]="14" />
                  } @else if (changeInRange()! < 0) {
                    <app-icon name="trend-down" [size]="14" />
                  } @else {
                    <app-icon name="minus" [size]="14" />
                  }
                  {{ formatChange(changeInRange()!) }} in {{ selectedRange() === 'ALL' ? 'total' : selectedRange() }}
                </span>
              } @else {
                <span class="delta delta-flat">
                  <app-icon [name]="changeInRange()! >= 0 ? 'arrow-up' : 'arrow-down'" [size]="14" />
                  {{ formatChange(changeInRange()!) }} net change {{ selectedRange() === 'ALL' ? 'overall' : 'in ' + selectedRange() }}
                </span>
              }
            }
          </div>
        }
        <app-line-chart
          class="chart-plot"
          [style.min-height.px]="height()"
          [points]="visible()"
          [tone]="tone()"
          [height]="height()"
          [fill]="true"
          [valueFormatter]="format"
          [compactFormatter]="compact"
          [ariaLabel]="ariaLabel()"
        />
        @if (caption()) {
          <p class="chart-caption text-secondary text-xs">{{ caption() }}</p>
        }
        @if (showTable()) {
          <div class="table-wrap chart-table">
            <table class="table">
              <caption class="visually-hidden">{{ title() }} data points</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" class="num">Value</th>
                  <th scope="col">Activity</th>
                </tr>
              </thead>
              <tbody>
                @for (point of tableRows(); track point.time) {
                  <tr>
                    <td>{{ point.time | dateTime }}</td>
                    <td class="num">{{ format(point.value) }}</td>
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

    /* The card takes the whole grid cell; the plot takes whatever the header, summary and caption leave. */
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
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .chart-current {
      font-size: var(--text-2xl);
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .chart-caption {
      margin-top: 4px;
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
  readonly title = input<string>('Portfolio');
  readonly subtitle = input<string>('');
  readonly series = input<SeriesPoint[]>([]);
  readonly loading = input<boolean>(false);
  /** Minimum plot height in pixels; the plot grows when the card is stretched taller. */
  readonly height = input<number>(280);
  readonly caption = input<string>('');
  readonly emptyTitle = input<string>('No history yet');
  readonly emptyMessage = input<string>('');
  readonly currency = input<string>('USD');
  readonly ariaLabel = input<string>('Portfolio over time');
  /** Colour the line and delta by direction. Turn off for series where "down" is not a loss. */
  readonly deltaColoring = input<boolean>(true);

  protected readonly ranges = CHART_RANGES;
  protected readonly selectedRange = signal<ChartRange>('ALL');
  protected readonly showTable = signal(false);
  private readonly now = signal(Date.now());

  protected readonly availability = computed<Record<ChartRange, boolean>>(() => {
    const points = this.series();
    const now = this.now();
    return Object.fromEntries(CHART_RANGES.map((range) => [range, rangeHasData(points, range, now)])) as Record<ChartRange, boolean>;
  });

  protected readonly visible = computed(() => sliceSeries(this.series(), this.selectedRange(), this.now()));
  protected readonly tableRows = computed(() => this.visible().filter((point) => point.note !== undefined || this.visible().length <= 2));
  protected readonly latestValue = computed(() => this.visible().at(-1)?.value ?? 0);
  protected readonly changeInRange = computed(() => {
    const points = this.visible();
    if (points.length < 2) {
      return null;
    }
    return points[points.length - 1].value - points[0].value;
  });
  protected readonly tone = computed<ChartTone>(() => {
    const change = this.changeInRange();
    if (!this.deltaColoring() || change === null || change === 0) {
      return 'neutral';
    }
    return change > 0 ? 'positive' : 'negative';
  });

  protected readonly format = (value: number): string => formatMoney(value, this.currency());
  protected readonly compact = (value: number): string => formatCompactMoney(value, this.currency());

  constructor() {
    // When the data changes, refresh "now" and fall back to a range that actually has data.
    effect(() => {
      this.series();
      this.now.set(Date.now());
      const available = this.availability();
      if (!available[this.selectedRange()]) {
        this.selectedRange.set('ALL');
      }
    });
  }

  protected formatChange(change: number): string {
    const formatted = formatMoney(Math.abs(change), this.currency());
    return change > 0 ? `+${formatted}` : change < 0 ? `-${formatted}` : formatted;
  }
}
