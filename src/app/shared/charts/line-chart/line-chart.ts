import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { SeriesPoint } from '../../../core/models/portfolio.models';
import { EASTERN_TIME_ZONE, formatDate, formatDateTime } from '../../../core/utils/dates';

export type ChartTone = 'positive' | 'negative' | 'neutral';
export type ChartXScale = 'time' | 'index';
export type ChartTimeFormatter = (time: number) => string;

interface Tick {
  position: number;
  label: string;
  anchor?: 'start' | 'middle' | 'end';
}

interface PlottedPoint extends SeriesPoint {
  x: number;
  y: number;
}

const PADDING = { top: 18, right: 18, bottom: 32, left: 64 };

/**
 * Single-series SVG line chart: 2px line, 10% area wash, hairline grid, snapping
 * crosshair with a tooltip, keyboard navigation and a live-region readout.
 * With `fill` the plot grows to whatever height the parent layout gives the host.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.chart-fill]': 'fill()' },
  template: `
    <div class="chart-host" [style.height.px]="plotHeight()">
      @if (plotted().length >= 2) {
        <svg
          class="chart"
          [attr.viewBox]="'0 0 ' + width() + ' ' + plotHeight()"
          [attr.width]="width()"
          [attr.height]="plotHeight()"
          role="img"
          [attr.aria-label]="ariaLabel()"
          tabindex="0"
          (pointermove)="onPointerMove($event)"
          (pointerleave)="onPointerLeave()"
          (keydown)="onKeydown($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
        >
          <defs>
            <linearGradient [attr.id]="gradientId" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" [attr.stop-color]="lineColor()" stop-opacity="0.18" />
              <stop offset="100%" [attr.stop-color]="lineColor()" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- horizontal hairline grid + y labels -->
          @for (tick of yTicks(); track tick.position) {
            <line
              class="grid"
              [attr.x1]="padding.left"
              [attr.x2]="width() - padding.right"
              [attr.y1]="tick.position"
              [attr.y2]="tick.position"
            />
            <text
              class="axis-label"
              [attr.x]="padding.left - 10"
              [attr.y]="tick.position + 4"
              text-anchor="end"
            >
              {{ tick.label }}
            </text>
          }

          <!-- baseline + x labels -->
          <line
            class="axis"
            [attr.x1]="padding.left"
            [attr.x2]="width() - padding.right"
            [attr.y1]="plotBottom()"
            [attr.y2]="plotBottom()"
          />
          @for (tick of xTicks(); track tick.position) {
            <text
              class="axis-label"
              [attr.x]="tick.position"
              [attr.y]="plotHeight() - 10"
              [attr.text-anchor]="tick.anchor ?? 'middle'"
            >
              {{ tick.label }}
            </text>
          }

          <path class="area" [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId + ')'" />
          <path class="line" [attr.d]="linePath()" [attr.stroke]="lineColor()" />

          <!-- end marker: >= 8px, with a 2px surface ring -->
          @if (lastPoint(); as last) {
            <circle class="marker-ring" [attr.cx]="last.x" [attr.cy]="last.y" r="6" />
            <circle
              class="marker"
              [attr.cx]="last.x"
              [attr.cy]="last.y"
              r="4"
              [attr.fill]="lineColor()"
            />
          }

          <!-- crosshair -->
          @if (activePoint(); as active) {
            <line
              class="crosshair"
              [attr.x1]="active.x"
              [attr.x2]="active.x"
              [attr.y1]="padding.top"
              [attr.y2]="plotBottom()"
            />
            <circle class="marker-ring" [attr.cx]="active.x" [attr.cy]="active.y" r="7" />
            <circle
              class="marker"
              [attr.cx]="active.x"
              [attr.cy]="active.y"
              r="5"
              [attr.fill]="lineColor()"
            />
          }
        </svg>

        @if (activePoint(); as active) {
          <div
            class="tooltip"
            [style.left.px]="tooltipLeft()"
            [style.top.px]="active.y"
            role="presentation"
          >
            <span class="tooltip-value">{{ valueFormatter()(active.value) }}</span>
            <span class="tooltip-date">{{ tooltipDate(active) }}</span>
            @if (active.note) {
              <span class="tooltip-note">{{ active.note }}</span>
            }
          </div>
        }
        <span class="visually-hidden" aria-live="polite">{{ liveText() }}</span>
      } @else {
        <div class="chart-empty" role="img" [attr.aria-label]="ariaLabel()">
          <ng-content />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    :host(.chart-fill) {
      overflow: hidden;
    }

    .chart-host {
      position: relative;
      width: 100%;
      overflow: hidden;
    }

    .chart {
      display: block;
      touch-action: pan-y;
      cursor: crosshair;
    }

    .chart:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
      border-radius: var(--radius-md);
    }

    .grid {
      stroke: var(--chart-grid);
      stroke-width: 1;
    }

    .axis {
      stroke: var(--chart-axis);
      stroke-width: 1;
    }

    .axis-label {
      fill: var(--chart-muted);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .line {
      fill: none;
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }

    .area {
      stroke: none;
    }

    .marker-ring {
      fill: var(--color-surface);
    }

    .crosshair {
      stroke: var(--chart-axis);
      stroke-width: 1;
    }

    .tooltip {
      position: absolute;
      transform: translate(0, -50%);
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-md);
      pointer-events: none;
      white-space: nowrap;
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      z-index: 2;
    }

    .tooltip-value {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }

    .chart-empty {
      height: 100%;
      display: grid;
      place-items: center;
    }
  `,
})
export class LineChartComponent {
  private static nextId = 0;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly points = input<SeriesPoint[]>([]);
  /** Plot height in pixels; with `fill` it is the minimum. */
  readonly height = input<number>(280);
  /** Grow the plot to the host's own height (the parent sizes the host, e.g. with flex). */
  readonly fill = input<boolean>(false);
  readonly tone = input<ChartTone>('neutral');
  /** `index` gives every real observation equal space; useful for exchange-session data. */
  readonly xScale = input<ChartXScale>('time');
  readonly xTickFormatter = input<ChartTimeFormatter | null>(null);
  readonly tooltipTimeFormatter = input<ChartTimeFormatter | null>(null);
  readonly valueFormatter = input<(value: number) => string>((value) => String(value));
  readonly compactFormatter = input<(value: number) => string>((value) => String(value));
  readonly ariaLabel = input<string>('Line chart');

  protected readonly padding = PADDING;
  protected readonly gradientId = `line-chart-gradient-${LineChartComponent.nextId++}`;
  protected readonly width = signal(720);
  protected readonly activeIndex = signal<number | null>(null);
  private readonly focused = signal(false);
  /** Measured host height, only tracked in `fill` mode. */
  private readonly hostHeight = signal<number | null>(null);

  /** Effective plot height: the measured host height when filling, otherwise the `height` input. */
  protected readonly plotHeight = computed(() => {
    const measured = this.hostHeight();
    return this.fill() && measured !== null ? Math.max(this.height(), measured) : this.height();
  });

  protected readonly plotBottom = computed(() => this.plotHeight() - PADDING.bottom);

  protected readonly lineColor = computed(() => {
    switch (this.tone()) {
      case 'negative':
        return 'var(--chart-negative)';
      default:
        return 'var(--chart-series-1)';
    }
  });

  private readonly domain = computed(() => {
    const points = this.points();
    if (points.length === 0) {
      return null;
    }
    const times = points.map((point) => point.time);
    const values = points.map((point) => point.value);
    let minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    if (minTime === maxTime) {
      minTime -= 86_400_000;
      maxTime += 86_400_000;
    }
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (minValue === maxValue) {
      const pad = Math.abs(minValue) * 0.1 || 1;
      minValue -= pad;
      maxValue += pad;
    } else {
      const pad = (maxValue - minValue) * 0.08;
      minValue -= pad;
      maxValue += pad;
    }
    if (minValue < 0 && Math.min(...values) >= 0) {
      minValue = 0;
    }
    return { minTime, maxTime, minValue, maxValue };
  });

  protected readonly plotted = computed<PlottedPoint[]>(() => {
    const domain = this.domain();
    if (!domain) {
      return [];
    }
    const width = this.width();
    const innerWidth = Math.max(1, width - PADDING.left - PADDING.right);
    const innerHeight = Math.max(1, this.plotHeight() - PADDING.top - PADDING.bottom);
    const points = this.points();
    const lastIndex = Math.max(1, points.length - 1);
    return points.map((point, index) => ({
      ...point,
      x:
        PADDING.left +
        (this.xScale() === 'index'
          ? index / lastIndex
          : (point.time - domain.minTime) / (domain.maxTime - domain.minTime)) *
          innerWidth,
      y:
        PADDING.top +
        (1 - (point.value - domain.minValue) / (domain.maxValue - domain.minValue)) * innerHeight,
    }));
  });

  protected readonly linePath = computed(() => {
    const points = this.plotted();
    if (points.length === 0) {
      return '';
    }
    return points
      .map(
        (point, index) =>
          `${index === 0 || point.breakBefore ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(' ');
  });

  protected readonly areaPath = computed(() => {
    const points = this.plotted();
    if (points.length === 0) {
      return '';
    }
    // A single filled polygon would visually bridge unknown observations, so gaps have no area wash.
    if (points.some((point) => point.breakBefore)) {
      return '';
    }
    const first = points[0];
    const last = points[points.length - 1];
    const bottom = this.plotBottom();
    return `${this.linePath()} L${last.x.toFixed(1)} ${bottom} L${first.x.toFixed(1)} ${bottom} Z`;
  });

  protected readonly lastPoint = computed(() => this.plotted().at(-1) ?? null);

  protected readonly yTicks = computed<Tick[]>(() => {
    const domain = this.domain();
    if (!domain) {
      return [];
    }
    const steps = niceTicks(domain.minValue, domain.maxValue, 4);
    const innerHeight = Math.max(1, this.plotHeight() - PADDING.top - PADDING.bottom);
    return steps
      .filter((value) => value >= domain.minValue && value <= domain.maxValue)
      .map((value) => ({
        position:
          PADDING.top +
          (1 - (value - domain.minValue) / (domain.maxValue - domain.minValue)) * innerHeight,
        label: this.compactFormatter()(value),
      }));
  });

  protected readonly xTicks = computed<Tick[]>(() => {
    const domain = this.domain();
    if (!domain) {
      return [];
    }
    const width = this.width();
    const innerWidth = Math.max(1, width - PADDING.left - PADDING.right);
    const count = Math.max(
      2,
      Math.min(6, Math.floor(innerWidth / (this.xTickFormatter() ? 150 : 120))),
    );
    const span = domain.maxTime - domain.minTime;
    const ticks: Tick[] = [];
    for (let index = 0; index < count; index++) {
      const pointIndex = Math.round(((this.points().length - 1) * index) / (count - 1));
      const time =
        this.xScale() === 'index'
          ? this.points()[pointIndex].time
          : domain.minTime + (span * index) / (count - 1);
      ticks.push({
        position:
          PADDING.left +
          (this.xScale() === 'index'
            ? pointIndex / Math.max(1, this.points().length - 1)
            : index / (count - 1)) *
            innerWidth,
        label: this.xTickFormatter()?.(time) ?? formatAxisDate(time, span),
        anchor: index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle',
      });
    }
    return ticks;
  });

  protected readonly activePoint = computed(() => {
    const index = this.activeIndex();
    return index === null ? null : (this.plotted()[index] ?? null);
  });

  protected readonly tooltipLeft = computed(() => {
    const active = this.activePoint();
    if (!active) {
      return 0;
    }
    const width = this.width();
    return active.x > width * 0.65 ? active.x - 190 : active.x + 14;
  });

  protected readonly liveText = computed(() => {
    const active = this.activePoint();
    if (!active || !this.focused()) {
      return '';
    }
    return `${this.tooltipDate(active)}: ${this.valueFormatter()(active.value)}${active.note ? `. ${active.note}` : ''}`;
  });

  constructor() {
    afterNextRender(() => {
      const element = this.host.nativeElement;
      const measure = () => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0) {
          this.width.set(Math.round(rect.width));
        }
        if (this.fill() && rect.height > 0) {
          this.hostHeight.set(Math.round(rect.height));
        }
      };
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => measure());
        observer.observe(element);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
  }

  protected tooltipDate(point: SeriesPoint): string {
    const formatter = this.tooltipTimeFormatter();
    if (formatter) {
      return formatter(point.time);
    }
    const domain = this.domain();
    const span = domain ? domain.maxTime - domain.minTime : 0;
    return span < 3 * 86_400_000 ? formatDateTime(point.time) : formatDate(point.time);
  }

  protected onPointerMove(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.width();
    this.activeIndex.set(this.nearestIndex(x));
  }

  protected onPointerLeave(): void {
    if (!this.focused()) {
      this.activeIndex.set(null);
    }
  }

  protected onFocus(): void {
    this.focused.set(true);
    if (this.activeIndex() === null) {
      this.activeIndex.set(this.plotted().length - 1);
    }
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.activeIndex.set(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.plotted().length;
    if (count === 0) {
      return;
    }
    const current = this.activeIndex() ?? count - 1;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, current - 1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(count - 1, current + 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.activeIndex.set(next);
  }

  private nearestIndex(x: number): number | null {
    const points = this.plotted();
    if (points.length === 0) {
      return null;
    }
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }
}

/** Clean tick values (1, 2, 5 x 10^n) covering [min, max] with roughly `count` steps. */
export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (!(span > 0)) {
    return [min];
  }
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step = (residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + 1e-9; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

function formatAxisDate(time: number, spanMs: number): string {
  const date = new Date(time);
  if (spanMs <= 2 * 86_400_000) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: EASTERN_TIME_ZONE,
    }).format(date);
  }
  if (spanMs <= 200 * 86_400_000) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: EASTERN_TIME_ZONE,
    }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: EASTERN_TIME_ZONE,
  }).format(date);
}
