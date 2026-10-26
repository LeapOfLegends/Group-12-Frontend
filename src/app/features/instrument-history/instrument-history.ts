import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { describeHttpError } from '../../core/utils/http-error';
import { formatCompactMoney, formatPrice } from '../../core/utils/money';
import { AppVisibilityService } from '../../core/services/app-visibility.service';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { LineChartComponent } from '../../shared/charts/line-chart/line-chart';
import { DateTimePipe, PricePipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';

@Component({
  selector: 'app-instrument-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LineChartComponent,
    DateTimePipe,
    PricePipe,
    IconComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './instrument-history.html',
  styleUrl: './instrument-history.scss',
})
export class InstrumentHistoryPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(InstrumentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalog = inject(InstrumentCatalogService);
  private readonly visibility = inject(AppVisibilityService);
  private instrumentId: number | null = null;
  private symbol: string | null = null;
  private instrumentRequest?: Subscription;
  private historyRequest?: Subscription;
  private resumeEffectReady = false;

  protected readonly ranges = INSTRUMENT_HISTORY_RANGES;
  protected readonly selectedRange = signal<InstrumentHistoryRange>('1D');
  private readonly instrumentState = signal<Instrument | null>(null);
  protected readonly instrument = computed<Instrument | null>(() => {
    const loaded = this.instrumentState();
    return loaded ? (this.catalog.bySymbol().get(loaded.symbol) ?? loaded) : null;
  });
  protected readonly history = signal<InstrumentHistory | null>(null);
  protected readonly instrumentLoading = signal(true);
  protected readonly historyLoading = signal(true);
  protected readonly instrumentError = signal<string | null>(null);
  protected readonly historyError = signal<string | null>(null);
  protected readonly points = computed<SeriesPoint[]>(() =>
    (this.history()?.points ?? [])
      .map((point) => ({ time: Date.parse(point.timestamp), value: Number(point.close) }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
      .sort((a, b) => a.time - b.time),
  );
  protected readonly formatValue = (value: number): string =>
    formatPrice(value, this.instrument()?.currency ?? this.history()?.currency ?? 'USD');
  protected readonly formatCompact = (value: number): string =>
    formatCompactMoney(value, this.instrument()?.currency ?? this.history()?.currency ?? 'USD');
  protected readonly formatAxisTime = (time: number): string =>
    formatEquityAxisTime(time, this.selectedRange());
  protected readonly formatTooltipTime = (time: number): string =>
    formatEquityTooltipTime(time, this.selectedRange());

  constructor() {
    interval(environment.historyPollIntervalMs)
      .pipe(
        filter(
          () =>
            this.visibility.visible() &&
            (this.selectedRange() === '1D' || this.selectedRange() === '5D'),
        ),
        takeUntilDestroyed(),
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
          if (this.selectedRange() === '1D' || this.selectedRange() === '5D') {
            this.loadHistory(true);
          }
        });
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const key = params.get('instrumentId') ?? '';
      const id = Number(key);
      this.instrumentRequest?.unsubscribe();
      this.historyRequest?.unsubscribe();
      this.instrumentState.set(null);
      this.history.set(null);
      this.instrumentId = Number.isSafeInteger(id) && id > 0 ? id : null;
      this.symbol = this.instrumentId === null && /^[A-Za-z][A-Za-z0-9.-]*$/.test(key) ? key : null;
      if (this.instrumentId === null && this.symbol === null) {
        this.instrumentLoading.set(false);
        this.historyLoading.set(false);
        this.instrumentError.set('This instrument could not be found.');
        return;
      }
      this.loadInstrument();
      this.loadHistory();
    });
  }

  protected setRange(range: InstrumentHistoryRange): void {
    if (range === this.selectedRange()) return;
    this.selectedRange.set(range);
    this.loadHistory();
  }

  protected retry(): void {
    if (this.instrumentError()) this.loadInstrument();
    if (this.historyError()) this.loadHistory();
  }

  private loadInstrument(): void {
    if (this.instrumentId === null && this.symbol === null) return;
    this.instrumentRequest?.unsubscribe();
    this.instrumentLoading.set(true);
    this.instrumentError.set(null);
    this.instrumentRequest = (
      this.instrumentId !== null
        ? this.api.getById(this.instrumentId)
        : this.api.getBySymbol(this.symbol!)
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (instrument) => {
          this.instrumentState.set(instrument);
          this.instrumentLoading.set(false);
        },
        error: (error: unknown) => {
          this.instrumentLoading.set(false);
          this.instrumentError.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'This instrument could not be found.'
              : describeHttpError(error, 'Instrument details could not be loaded.'),
          );
        },
      });
  }

  private loadHistory(silent = false): void {
    if (this.instrumentId === null && this.symbol === null) return;
    this.historyRequest?.unsubscribe();
    if (!silent) {
      this.history.set(null);
      this.historyLoading.set(true);
      this.historyError.set(null);
    }
    this.historyRequest = (
      this.instrumentId !== null
        ? this.api.getHistory(this.instrumentId, this.selectedRange())
        : this.api.getHistoryBySymbol(this.symbol!, this.selectedRange())
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          this.history.set(history);
          this.historyLoading.set(false);
        },
        error: (error: unknown) => {
          this.historyLoading.set(false);
          if (silent && this.history()) return;
          const status = error instanceof HttpErrorResponse ? error.status : null;
          this.historyError.set(
            status === 404
              ? 'No price history was found for this instrument.'
              : status === 422
                ? 'Price history is not available for this instrument.'
                : status === 503
                  ? 'Price history is temporarily unavailable. Please try again shortly.'
                  : describeHttpError(error, 'Price history could not be loaded.'),
          );
        },
      });
  }
}

const EXCHANGE_TIME_ZONE = 'America/New_York';

export function formatEquityAxisTime(time: number, range: InstrumentHistoryRange): string {
  const options: Intl.DateTimeFormatOptions =
    range === '1D'
      ? { hour: 'numeric', minute: '2-digit', timeZone: EXCHANGE_TIME_ZONE }
      : range === '5D'
        ? {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: EXCHANGE_TIME_ZONE,
          }
        : range === '5Y'
          ? { month: 'short', year: '2-digit', timeZone: EXCHANGE_TIME_ZONE }
          : { month: 'short', day: 'numeric', timeZone: EXCHANGE_TIME_ZONE };
  return new Intl.DateTimeFormat('en-US', options).format(new Date(time));
}

export function formatEquityTooltipTime(time: number, range: InstrumentHistoryRange): string {
  const intraday = range === '1D' || range === '5D';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(intraday ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: EXCHANGE_TIME_ZONE,
    timeZoneName: 'short',
  }).format(new Date(time));
}
