import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { IconComponent } from '../icon/icon';

export interface PagedRows<T> {
  /** Zero-based page currently shown, always within range. */
  readonly page: Signal<number>;
  /** The rows on that page. */
  readonly rows: Signal<readonly T[]>;
  goTo(page: number): void;
}

/**
 * Page state for a client-side table: back to the first page whenever `resetOn` changes (a new
 * search, sort or filter) and clamped to the last page when rows disappear, such as after a delete.
 */
export function pagedRows<T>(
  rows: () => readonly T[],
  pageSize: number,
  resetOn: () => unknown,
): PagedRows<T> {
  const requested = linkedSignal({ source: resetOn, computation: () => 0 });
  const lastPage = computed(() => Math.max(0, Math.ceil(rows().length / pageSize) - 1));
  const page = computed(() => Math.min(requested(), lastPage()));
  return {
    page,
    rows: computed(() => rows().slice(page() * pageSize, (page() + 1) * pageSize)),
    goTo: (index) => requested.set(Math.max(0, index)),
  };
}

/**
 * Footer for a client-side paged table: the visible range plus previous / next arrows.
 * Pages are zero-based; the host owns the page and slices its rows.
 */
@Component({
  selector: 'app-table-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pager">
      <span class="text-secondary text-sm"
        >Showing {{ first() }}–{{ last() }} of {{ total() }}</span
      >
      @if (pageCount() > 1) {
        <nav class="pager-controls" [attr.aria-label]="label()">
          <button
            type="button"
            class="btn btn-secondary btn-icon"
            aria-label="Previous page"
            [disabled]="page() === 0"
            (click)="pageChange.emit(page() - 1)"
          >
            <app-icon name="chevron-left" [size]="18" />
          </button>
          <span class="pager-status text-sm" aria-live="polite"
            >Page {{ page() + 1 }} of {{ pageCount() }}</span
          >
          <button
            type="button"
            class="btn btn-secondary btn-icon"
            aria-label="Next page"
            [disabled]="page() >= pageCount() - 1"
            (click)="pageChange.emit(page() + 1)"
          >
            <app-icon name="chevron-right" [size]="18" />
          </button>
        </nav>
      }
    </div>
  `,
  styles: `
    .pager {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-3);
    }

    .pager-controls {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .pager-status {
      min-width: 9ch;
      text-align: center;
      color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TablePagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  /** Accessible name of the arrow group, e.g. "Client cash positions pages". */
  readonly label = input('Table pages');
  readonly pageChange = output<number>();

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );
  protected readonly first = computed(() =>
    this.total() === 0 ? 0 : this.page() * this.pageSize() + 1,
  );
  protected readonly last = computed(() =>
    Math.min(this.total(), (this.page() + 1) * this.pageSize()),
  );
}
