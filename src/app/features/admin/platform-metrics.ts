import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalyticsApiService,
  MetricsRange,
  PlatformMetrics,
} from '../../core/api/analytics-api.service';
import { AppVisibilityService } from '../../core/services/app-visibility.service';
import { describeHttpError } from '../../core/utils/http-error';
import { formatCompactMoney, formatInteger } from '../../core/utils/money';
import { FinancialSummaryCardComponent } from '../../shared/ui/financial-summary-card/financial-summary-card';
import { IconComponent } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-platform-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FinancialSummaryCardComponent, IconComponent],
  template: `
    <section class="stack" aria-labelledby="platform-metrics-title" [attr.aria-busy]="loading()">
      <div class="metrics-heading">
        <div class="metrics-title">
          <h3 id="platform-metrics-title">Platform activity</h3>
          <span class="text-secondary text-sm">{{ selectedLabel() }}</span>
        </div>
        <div class="metrics-controls">
          <fieldset class="periods">
            <legend class="visually-hidden">Platform metrics period</legend>
            @for (option of ranges; track option.value) {
              <label class="period" [class.selected]="range() === option.value">
                <input
                  type="radio"
                  name="metrics-period"
                  [value]="option.value"
                  [checked]="range() === option.value"
                  (change)="range.set(option.value)"
                />
                <span>{{ option.label }}</span>
              </label>
            }
          </fieldset>
        </div>
      </div>

      @if (error(); as message) {
        <div class="alert alert-error" role="alert">
          <app-icon name="alert-circle" />
          <span>{{ message }}</span>
          <button type="button" class="btn btn-sm btn-secondary" (click)="reload()">Retry</button>
        </div>
      } @else {
        <div class="grid metrics-grid" aria-live="polite">
          <app-financial-summary-card
            label="Total orders"
            [value]="count(metrics()?.totalOrders)"
            hint="Submitted in period"
            icon="activity"
            [loading]="loading()"
          />
          <app-financial-summary-card
            label="Filled orders"
            [value]="count(metrics()?.filledOrders)"
            hint="Filled in period"
            icon="check"
            [loading]="loading()"
          />
          <app-financial-summary-card
            label="Pending orders"
            [value]="count(metrics()?.pendingOrders)"
            hint="Submitted in period"
            icon="clock"
            [loading]="loading()"
          />
          <app-financial-summary-card
            label="Failed / rejected orders"
            [value]="count(metrics()?.failedRejectedOrders)"
            hint="Submitted in period"
            icon="alert-circle"
            [loading]="loading()"
          />
          <app-financial-summary-card
            label="Total deposits"
            [value]="funding(metrics()?.totalDeposits)"
            hint="Deposited in period"
            icon="wallet"
            [loading]="loading()"
          />
          <app-financial-summary-card
            label="Total withdrawals"
            [value]="funding(metrics()?.totalWithdrawals)"
            hint="Withdrawn in period"
            icon="wallet"
            [loading]="loading()"
          />
          @for (volume of metrics()?.tradingValues ?? []; track volume.currency) {
            <app-financial-summary-card
              [label]="'Trading value (' + volume.currency + ')'"
              [value]="money(volume.value, volume.currency)"
              hint="Filled in period"
              icon="dollar"
            />
          } @empty {
            <app-financial-summary-card
              label="Trading value"
              [value]="loading() ? '-' : '0'"
              hint="No filled trades"
              icon="dollar"
              [loading]="loading()"
            />
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .metrics-heading,
    .metrics-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .metrics-heading {
      justify-content: space-between;
    }
    .metrics-title {
      display: grid;
      gap: 4px;
    }
    h3 {
      font-size: var(--text-lg);
    }
    .periods {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      padding: 3px;
      margin: 0;
      min-width: 0;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface-2);
    }
    .period {
      position: relative;
      cursor: pointer;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: var(--text-sm);
      font-weight: 600;
      white-space: nowrap;
    }
    .period.selected {
      background: var(--color-brand-soft);
      color: var(--color-on-brand-soft);
    }
    .period:focus-within {
      outline: 2px solid var(--color-brand);
      outline-offset: 2px;
    }
    .period input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
    }
    .metrics-grid {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
      align-items: stretch;
    }
    .alert button {
      margin-left: auto;
    }
    @media (max-width: 480px) {
      .metrics-controls {
        width: 100%;
        gap: 8px;
      }
      .period {
        padding: 8px;
      }
      .metrics-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PlatformMetricsComponent {
  private readonly api = inject(AnalyticsApiService);
  private readonly visibility = inject(AppVisibilityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly revision = signal(0);
  private loadedRange: MetricsRange | null = null;
  protected readonly range = signal<MetricsRange>('all');
  protected readonly metrics = signal<PlatformMetrics | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ranges: { value: MetricsRange; label: string }[] = [
    { value: 'week', label: 'Past week' },
    { value: 'month', label: 'Past month' },
    { value: 'year', label: 'Past year' },
    { value: 'all', label: 'All time' },
  ];

  constructor() {
    timer(environment.adminPollIntervalMs, environment.adminPollIntervalMs)
      .pipe(
        filter(() => this.visibility.visible()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.revision.update((value) => value + 1));

    effect((onCleanup) => {
      const range = this.range();
      this.revision();
      const initial = untracked(() => this.metrics() === null || this.loadedRange !== range);
      if (initial) {
        this.loading.set(true);
        this.metrics.set(null);
      }
      this.error.set(null);
      const request = this.api.platformMetrics(range).subscribe({
        next: (metrics) => {
          this.loadedRange = range;
          this.metrics.set(metrics);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          if (this.metrics() === null) {
            this.error.set(describeHttpError(error, 'Platform metrics could not be loaded.'));
          }
          this.loading.set(false);
        },
      });
      onCleanup(() => request.unsubscribe());
    });
  }

  reload(): void {
    this.revision.update((value) => value + 1);
  }

  protected selectedLabel(): string {
    return this.ranges.find((option) => option.value === this.range())!.label;
  }

  protected count(value: number | undefined): string {
    return value === undefined ? '-' : formatInteger(value);
  }

  protected money(value: number, currency: string): string {
    return formatCompactMoney(value, currency);
  }

  protected funding(value: number | undefined): string {
    return value === undefined ? '-' : formatCompactMoney(value);
  }
}
