import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton';

export type DeltaTone = 'up' | 'down' | 'flat';

/**
 * Stat tile for the dashboard's headline figures: label, large value, an optional
 * signed delta with a direction icon, a hint line and an optional link.
 */
@Component({
  selector: 'app-financial-summary-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LoadingSkeletonComponent],
  template: `
    <article class="card summary-card" [class.summary-card-accent]="accent()">
      @if (loading()) {
        <app-loading-skeleton variant="tile" />
      } @else {
        <div class="summary-top">
          <span class="summary-label">{{ label() }}</span>
          @if (icon()) {
            <span class="summary-icon"><app-icon [name]="icon()" [size]="18" /></span>
          }
        </div>
        <p class="summary-value" [attr.aria-label]="label() + ' ' + value()">{{ value() }}</p>
        <div class="summary-bottom">
          @if (delta()) {
            <span class="delta" [class]="'delta delta-' + deltaTone()">
              @if (deltaTone() === 'up') {
                <app-icon name="trend-up" [size]="14" />
              } @else if (deltaTone() === 'down') {
                <app-icon name="trend-down" [size]="14" />
              } @else {
                <app-icon name="minus" [size]="14" />
              }
              {{ delta() }}
            </span>
          }
          @if (hint()) {
            <span class="summary-hint">{{ hint() }}</span>
          }
        </div>
        @if (linkLabel() && linkRoute()) {
          <a class="summary-link" [routerLink]="linkRoute()">
            {{ linkLabel() }}
            <app-icon name="arrow-right" [size]="16" />
          </a>
        }
        <ng-content />
      }
    </article>
  `,
  styles: `
    .summary-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 150px;
      position: relative;
      overflow: hidden;
    }

    .summary-card-accent::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 4px;
      background: linear-gradient(90deg, var(--color-brand), var(--color-accent));
    }

    .summary-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .summary-label {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .summary-icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--color-brand-soft);
      color: var(--color-brand);
    }

    .summary-value {
      font-size: var(--text-3xl);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--color-text);
    }

    .summary-bottom {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--text-sm);
      min-height: 20px;
    }

    .summary-hint {
      color: var(--color-text-secondary);
    }

    .summary-link {
      margin-top: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-sm);
      font-weight: 600;
      width: fit-content;
    }

    @media (max-width: 720px) {
      .summary-value {
        font-size: var(--text-2xl);
      }

      .summary-card {
        min-height: 0;
      }
    }
  `,
})
export class FinancialSummaryCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<string>('');
  readonly deltaTone = input<DeltaTone>('flat');
  readonly hint = input<string>('');
  readonly icon = input<string>('');
  readonly loading = input<boolean>(false);
  readonly accent = input<boolean>(false);
  readonly linkLabel = input<string>('');
  readonly linkRoute = input<string | null>(null);
}
