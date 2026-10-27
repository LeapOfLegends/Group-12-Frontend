import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, filter, interval } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InstrumentsApiService } from '../../core/api/instruments-api.service';
import { SeriesPoint } from '../../core/models/portfolio.models';
import {
  INSTRUMENT_HISTORY_RANGES,
  Instrument,
  InstrumentHistory,
  InstrumentHistoryRange,
} from '../../core/models/trading.models';
import { AppVisibilityService } from '../../core/services/app-visibility.service';
import { EASTERN_TIME_ZONE } from '../../core/utils/dates';
import { describeHttpError } from '../../core/utils/http-error';
import { formatCompactMoney, formatPrice } from '../../core/utils/money';
import { LineChartComponent } from '../../shared/charts/line-chart/line-chart';
import { DateTimePipe, PricePipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';

/** Shared historical-price presentation used by trade entry and the deep-link history page. */
@Component({
  selector: 'app-instrument-history-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChartComponent, DateTimePipe, PricePipe, IconComponent, LoadingSkeletonComponent],
  templateUrl: './instrument-history-chart.html',
  styleUrl: './instrument-history-chart.scss',
})
export class InstrumentHistoryChartComponent {
  private readonly api = inject(InstrumentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly visibility = inject(AppVisibilityService);
  private historyRequest?: Subscription;
  private activeIdentity: string | null = null;
  private resumeEffectReady = false;

  readonly instrument = input.required<Instrument>();
  readonly instrumentId = input<number | null>(null);
  readonly height = input(360);

  protected readonly ranges = INSTRUMENT_HISTORY_RANGES;
  protected readonly selectedRange = signal<InstrumentHistoryRange>('1D');
  protected readonly history = signal<InstrumentHistory | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unavailable = signal<string | null>(null);
  protected readonly historyUnsupported = signal(false);

  private readonly identity = computed(() => {
    const instrument = this.instrument();
    return `${this.instrumentId() ?? instrument.instrumentId ?? instrument.symbol}|${instrument.assetClass}|${instrument.currency}`;
  });

  private readonly historyEligible = computed(() => {
    const instrument = this.instrument();
    const assetClass = instrument.assetClass.trim().toUpperCase();
    const currency = instrument.currency.trim().toUpperCase();
    return (
      ((assetClass === 'EQUITY' || assetClass === 'CRYPTO') && currency === 'USD') ||
      assetClass === 'FOREX'
    );
  });

  protected readonly historyTimeZoneLabel = 'Times shown in Eastern Time (ET).';

  protected readonly points = computed<SeriesPoint[]>(() =>
    (this.history()?.points ?? [])
      .map((point) => ({ time: Date.parse(point.timestamp), value: Number(point.close) }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
      .sort((a, b) => a.time - b.time),
  );

  protected readonly formatValue = (value: number): string =>
    formatPrice(value, this.instrument().currency || this.history()?.currency || 'USD');
  protected readonly formatCompact = (value: number): string =>
    formatCompactMoney(value, this.instrument().currency || this.history()?.currency || 'USD');
  protected readonly formatAxisTime = (time: number): string =>
    formatHistoryAxisTime(time, this.selectedRange());
  protected readonly formatTooltipTime = (time: number): string =>
    formatHistoryTooltipTime(time, this.selectedRange());

  constructor() {
    effect(() => {
      const identity = this.identity();
      const eligible = this.historyEligible();
      untracked(() => this.selectInstrument(identity, eligible));
    });

    interval(environment.historyPollIntervalMs)
      .pipe(
        filter(
          () =>
            this.visibility.visible() &&
            this.historyEligible() &&
            (this.selectedRange() === '1D' || this.selectedRange() === '5D'),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadHistory(true));

    effect(() => {
      this.visibility.resumeRevision();
      const visible = this.visibility.visible();
      if (!this.resumeEffectReady) {
        this.resumeEffectReady = true;
        return;
      }
      if (visible) {
        untracked(() => {
          if (
            this.historyEligible() &&
            (this.selectedRange() === '1D' || this.selectedRange() === '5D')
          ) {
            this.loadHistory(true);
          }
        });
      }
    });
  }

  protected setRange(range: InstrumentHistoryRange): void {
    if (range === this.selectedRange() || this.historyUnsupported()) {
      return;
    }
    this.selectedRange.set(range);
    this.loadHistory();
  }

  protected retry(): void {
    this.loadHistory();
  }

  private selectInstrument(identity: string, eligible: boolean): void {
    if (identity === this.activeIdentity) {
      return;
    }
    this.activeIdentity = identity;
    this.historyRequest?.unsubscribe();
    this.selectedRange.set('1D');
    this.history.set(null);
    this.error.set(null);
    this.unavailable.set(null);
    this.historyUnsupported.set(false);
    this.loading.set(false);

    if (!eligible) {
      this.historyUnsupported.set(true);
      this.unavailable.set('Price history is not available for this instrument type.');
      return;
    }
    this.loadHistory();
  }

  private loadHistory(silent = false): void {
    if (!this.historyEligible() || this.historyUnsupported()) {
      return;
    }
    this.historyRequest?.unsubscribe();
    const requestIdentity = this.identity();
    const requestRange = this.selectedRange();
    if (!silent) {
      this.history.set(null);
      this.loading.set(true);
      this.error.set(null);
      this.unavailable.set(null);
    }

    const instrument = this.instrument();
    const id = this.instrumentId() ?? instrument.instrumentId ?? null;
    const assetClass = instrument.assetClass.trim().toUpperCase();
    if (id === null && (assetClass === 'CRYPTO' || assetClass === 'FOREX')) {
      this.loading.set(false);
      this.unavailable.set(
        'Price history is unavailable because this instrument ID could not be resolved.',
      );
      return;
    }
    this.historyRequest = (
      id !== null
        ? this.api.getHistory(id, requestRange)
        : this.api.getHistoryBySymbol(instrument.symbol, requestRange)
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          if (requestIdentity !== this.identity() || requestRange !== this.selectedRange()) {
            return;
          }
          this.history.set(history);
          this.loading.set(false);
          this.error.set(null);
          this.unavailable.set(null);
        },
        error: (requestError: unknown) => {
          if (requestIdentity !== this.identity() || requestRange !== this.selectedRange()) {
            return;
          }
          this.loading.set(false);
          if (silent && this.history()) {
            return;
          }
          const status = requestError instanceof HttpErrorResponse ? requestError.status : null;
          if (status === 404) {
            this.unavailable.set('No price history was found for this instrument.');
            return;
          }
          if (status === 422) {
            this.historyUnsupported.set(true);
            this.unavailable.set('Price history is not available for this instrument.');
            return;
          }
          this.error.set(
            status === 503
              ? 'Price history is temporarily unavailable. Please try again shortly.'
              : describeHttpError(requestError, 'Price history could not be loaded.'),
          );
        },
      });
  }
}

export function formatHistoryAxisTime(time: number, range: InstrumentHistoryRange): string {
  const options: Intl.DateTimeFormatOptions =
    range === '1D'
      ? { hour: 'numeric', minute: '2-digit', timeZone: EASTERN_TIME_ZONE }
      : range === '5D'
        ? {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: EASTERN_TIME_ZONE,
          }
        : range === '5Y'
          ? { month: 'short', year: '2-digit', timeZone: EASTERN_TIME_ZONE }
          : { month: 'short', day: 'numeric', timeZone: EASTERN_TIME_ZONE };
  return new Intl.DateTimeFormat('en-US', options).format(new Date(time));
}

export function formatHistoryTooltipTime(time: number, range: InstrumentHistoryRange): string {
  const intraday = range === '1D' || range === '5D';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(intraday ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: EASTERN_TIME_ZONE,
    timeZoneName: 'short',
  }).format(new Date(time));
}

/** @deprecated Use the asset-aware history formatter instead. */
export const formatEquityAxisTime = formatHistoryAxisTime;

/** @deprecated Use the asset-aware history formatter instead. */
export const formatEquityTooltipTime = formatHistoryTooltipTime;
