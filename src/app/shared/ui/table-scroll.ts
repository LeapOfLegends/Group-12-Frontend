import {
  afterNextRender,
  afterRenderEffect,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

/** Keeps the header and first N rows visible without removing any table data. */
@Directive({
  selector: '[appTableScroll]',
  host: {
    '[style.max-height.px]': 'maxHeight()',
    '[style.overflow-y]': 'appTableScroll() ? "auto" : null',
    '[attr.tabindex]': 'maxHeight() !== null ? 0 : null',
    '[attr.role]': 'maxHeight() !== null ? "region" : null',
    '[attr.aria-label]': 'maxHeight() !== null ? tableScrollLabel() : null',
  },
})
export class TableScrollDirective {
  readonly appTableScroll = input<number | null>(null);
  readonly tableScrollLabel = input('Scrollable table');
  protected readonly maxHeight = signal<number | null>(null);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterRenderEffect({ read: () => this.measure() });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const table = this.element.querySelector('table');
      if (!table || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(table);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measure(): void {
    const count = this.appTableScroll();
    const table = this.element.querySelector('table');
    const rows = Array.from(table?.tBodies[0]?.rows ?? []);
    if (!count || count < 1 || rows.length <= count) {
      this.maxHeight.set(null);
      return;
    }

    // Measure actual rows: holdings and order failure details can span multiple lines.
    const headerHeight = table?.tHead?.getBoundingClientRect().height ?? 0;
    const rowsHeight = rows.slice(0, count)
      .reduce((height, row) => height + row.getBoundingClientRect().height, 0);
    const scrollbarHeight = this.element.offsetHeight - this.element.clientHeight;
    this.maxHeight.set(Math.ceil(headerHeight + rowsHeight + scrollbarHeight));
  }
}