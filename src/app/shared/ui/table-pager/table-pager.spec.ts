import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TablePagerComponent, pagedRows } from './table-pager';

describe('pagedRows', () => {
  const numbers = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

  it('slices pages of the given size', () => {
    const rows = signal(numbers(23));
    const paging = pagedRows(rows, 10, () => null);
    expect(paging.rows()).toEqual(numbers(10));

    paging.goTo(2);
    expect(paging.page()).toBe(2);
    expect(paging.rows()).toEqual([21, 22, 23]);
  });

  it('returns to the first page when the search or filter changes', () => {
    const rows = signal(numbers(30));
    const query = signal('');
    const paging = pagedRows(rows, 10, () => query());
    paging.goTo(2);

    query.set('jane');
    expect(paging.page()).toBe(0);
  });

  it('keeps the page in range when rows disappear and never goes below page one', () => {
    const rows = signal(numbers(21));
    const paging = pagedRows(rows, 10, () => null);
    paging.goTo(2);

    rows.set(numbers(20));
    expect(paging.page()).toBe(1);
    expect(paging.rows()).toEqual(numbers(20).slice(10));

    rows.set([]);
    expect(paging.page()).toBe(0);
    expect(paging.rows()).toEqual([]);

    paging.goTo(-4);
    expect(paging.page()).toBe(0);
  });
});

describe('TablePagerComponent', () => {
  let fixture: ComponentFixture<TablePagerComponent>;
  const element = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement | null;
  const button = (label: string) =>
    element(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

  async function render(page: number, total: number) {
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('label', 'Client pages');
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TablePagerComponent] }).compileComponents();
    fixture = TestBed.createComponent(TablePagerComponent);
  });

  it('shows the range and disables the back arrow on the first page', async () => {
    await render(0, 27);
    expect(element('.pager')?.textContent).toContain('Showing 1–10 of 27');
    expect(element('.pager-status')?.textContent?.trim()).toBe('Page 1 of 3');
    expect(element('nav')?.getAttribute('aria-label')).toBe('Client pages');
    expect(button('Previous page')?.disabled).toBe(true);
    expect(button('Next page')?.disabled).toBe(false);
  });

  it('disables the forward arrow on the last, partial page', async () => {
    await render(2, 27);
    expect(element('.pager')?.textContent).toContain('Showing 21–27 of 27');
    expect(button('Previous page')?.disabled).toBe(false);
    expect(button('Next page')?.disabled).toBe(true);
  });

  it('asks the host for the neighbouring page', async () => {
    await render(1, 27);
    const pages: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));
    button('Next page')?.click();
    button('Previous page')?.click();
    expect(pages).toEqual([2, 0]);
  });

  it('hides the arrows when everything fits on one page', async () => {
    await render(0, 4);
    expect(element('.pager')?.textContent).toContain('Showing 1–4 of 4');
    expect(element('nav')).toBeNull();
  });
});
