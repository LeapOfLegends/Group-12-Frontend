import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarListItem {
  label: string;
  value: number;
  /** 0..1 share of the total; used for the bar length and the percentage label. */
  share: number;
}

/**
 * Horizontal bars for a part-to-whole breakdown. One hue for nominal categories;
 * every value is also printed, so the bars never carry information alone.
 */
@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bar-list" [attr.aria-label]="ariaLabel()">
      @for (item of items(); track item.label) {
        <li class="bar-row">
          <div class="bar-meta">
            <span class="bar-label truncate">{{ item.label }}</span>
            <span class="bar-value tabular">{{ formatter()(item.value) }} <span class="bar-share">· {{ percent(item.share) }}</span></span>
          </div>
          <div class="bar-track" aria-hidden="true">
            <div class="bar-fill" [style.width.%]="Math.max(1, Math.round(item.share * 100))"></div>
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .bar-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .bar-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bar-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: var(--text-sm);
    }

    .bar-label {
      font-weight: 500;
    }

    .bar-value {
      color: var(--color-text);
      font-weight: 600;
      white-space: nowrap;
    }

    .bar-share {
      color: var(--color-text-secondary);
      font-weight: 400;
    }

    .bar-track {
      height: 8px;
      border-radius: 4px;
      background: var(--color-surface-3);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 0 4px 4px 0;
      background: var(--chart-series-1);
      transition: width 240ms ease;
    }
  `,
})
export class BarListComponent {
  readonly items = input<BarListItem[]>([]);
  readonly formatter = input<(value: number) => string>((value) => String(value));
  readonly ariaLabel = input<string>('Breakdown');

  protected readonly Math = Math;
  protected readonly total = computed(() => this.items().reduce((sum, item) => sum + item.value, 0));

  protected percent(share: number): string {
    return `${Math.round(share * 100)}%`;
  }
}
