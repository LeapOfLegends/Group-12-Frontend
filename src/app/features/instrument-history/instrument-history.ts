import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { InstrumentsApiService } from '../../core/api/instruments-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Instrument } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { describeHttpError } from '../../core/utils/http-error';
import { DateTimePipe, PricePipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { InstrumentHistoryChartComponent } from './instrument-history-chart';

export { formatEquityAxisTime, formatEquityTooltipTime } from './instrument-history-chart';

@Component({
  selector: 'app-instrument-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    InstrumentHistoryChartComponent,
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
  protected readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalog = inject(InstrumentCatalogService);
  private instrumentId: number | null = null;
  private symbol: string | null = null;
  private instrumentRequest?: Subscription;

  protected readonly historyInstrumentId = signal<number | null>(null);
  private readonly instrumentState = signal<Instrument | null>(null);
  protected readonly instrument = computed<Instrument | null>(() => {
    const loaded = this.instrumentState();
    return loaded ? (this.catalog.bySymbol().get(loaded.symbol) ?? loaded) : null;
  });
  protected readonly instrumentLoading = signal(true);
  protected readonly instrumentError = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const key = params.get('instrumentId') ?? '';
      const id = Number(key);
      this.instrumentRequest?.unsubscribe();
      this.instrumentState.set(null);
      this.instrumentId = Number.isSafeInteger(id) && id > 0 ? id : null;
      this.historyInstrumentId.set(this.instrumentId);
      this.symbol = this.instrumentId === null && /^[A-Za-z][A-Za-z0-9.-]*$/.test(key) ? key : null;
      if (this.instrumentId === null && this.symbol === null) {
        this.instrumentLoading.set(false);
        this.instrumentError.set('This instrument could not be found.');
        return;
      }
      this.loadInstrument();
    });
  }

  protected retry(): void {
    if (this.instrumentError()) {
      this.loadInstrument();
    }
  }

  private loadInstrument(): void {
    if (this.instrumentId === null && this.symbol === null) {
      return;
    }
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
}
