import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'card' | 'table' | 'chart' | 'tile';

/** Shimmering placeholders that mirror the shape of the content being loaded. */
@Component({
  selector: 'app-loading-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-live': 'polite', '[attr.aria-label]': 'label()' },
  template: `
    @switch (variant()) {
      @case ('tile') {
        <div class="sk-tile">
          <span class="skeleton sk-line" style="width: 40%"></span>
          <span class="skeleton sk-value"></span>
          <span class="skeleton sk-line" style="width: 55%"></span>
        </div>
      }
      @case ('chart') {
        <div class="sk-chart" [style.height.px]="height()">
          <span class="skeleton sk-plot"></span>
        </div>
      }
      @case ('table') {
        <div class="sk-table">
          @for (row of rows(); track row) {
            <div class="sk-row">
              <span class="skeleton sk-cell" style="width: 28%"></span>
              <span class="skeleton sk-cell" style="width: 18%"></span>
              <span class="skeleton sk-cell" style="width: 22%"></span>
              <span class="skeleton sk-cell" style="width: 16%"></span>
            </div>
          }
        </div>
      }
      @case ('card') {
        <div class="sk-card" [style.min-height.px]="height()">
          <span class="skeleton sk-line" style="width: 35%"></span>
          <span class="skeleton sk-line" style="width: 90%"></span>
          <span class="skeleton sk-line" style="width: 70%"></span>
        </div>
      }
      @default {
        <div class="sk-text">
          @for (row of rows(); track row) {
            <span class="skeleton sk-line" [style.width.%]="row === rows().length ? 60 : 100"></span>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .sk-tile,
    .sk-card,
    .sk-text {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sk-line {
      display: block;
      height: 14px;
    }

    .sk-value {
      display: block;
      height: 36px;
      width: 65%;
    }

    .sk-chart {
      display: flex;
      align-items: stretch;
    }

    .sk-plot {
      flex: 1;
      display: block;
      border-radius: var(--radius-md);
    }

    .sk-table {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sk-row {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .sk-cell {
      display: block;
      height: 16px;
    }
  `,
})
export class LoadingSkeletonComponent {
  readonly variant = input<SkeletonVariant>('text');
  readonly lines = input<number>(3);
  readonly height = input<number>(240);
  readonly label = input<string>('Loading');

  readonly rows = computed(() => Array.from({ length: Math.max(1, this.lines()) }, (_, index) => index + 1));
}
