import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TableScrollDirective } from './table-scroll';

@Component({
  imports: [TableScrollDirective],
  template: `
    <div [appTableScroll]="limit()" tableScrollLabel="Test holdings">
      <table>
        <thead><tr><th>Instrument</th></tr></thead>
        <tbody>
          @for (row of rows(); track row) {
            <tr><td>{{ row }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
class TestTable {
  readonly limit = signal<number | null>(3);
  readonly rows = signal([1, 2, 3, 4, 5]);
}

describe('TableScrollDirective', () => {
  let fixture: ComponentFixture<TestTable>;
  let viewport: HTMLElement;
  let resize: () => void;
  let rowHeight: number;
  const disconnect = vi.fn();

  beforeEach(async () => {
    rowHeight = 60;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { height: this.tagName === 'THEAD' ? 40 : rowHeight } as DOMRect;
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    await TestBed.configureTestingModule({ imports: [TestTable] }).compileComponents();
    fixture = TestBed.createComponent(TestTable);
    await fixture.whenStable();
    viewport = fixture.nativeElement.querySelector('div');
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    disconnect.mockClear();
  });

  it('fits the header and three rows while retaining every row and keyboard access', () => {
    expect(viewport.style.maxHeight).toBe('220px');
    expect(viewport.style.overflowY).toBe('auto');
    expect(viewport.querySelectorAll('tbody tr').length).toBe(5);
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('aria-label')).toBe('Test holdings');
  });

  it('recalculates when row heights change', async () => {
    rowHeight = 80;
    resize();
    await fixture.whenStable();
    expect(viewport.style.maxHeight).toBe('280px');
  });

  it('does not constrain short tables or leave an unnecessary tab stop', async () => {
    fixture.componentInstance.rows.set([1, 2]);
    await fixture.whenStable();
    resize(); // Browsers notify the observer when removing rows changes the table height.
    await fixture.whenStable();
    expect(viewport.style.maxHeight).toBe('');
    expect(viewport.hasAttribute('tabindex')).toBe(false);
    expect(viewport.hasAttribute('role')).toBe(false);
  });

  it('leaves tables unbounded when scrolling is not enabled', async () => {
    fixture.componentInstance.limit.set(null);
    await fixture.whenStable();
    expect(viewport.style.maxHeight).toBe('');
    expect(viewport.style.overflowY).toBe('');
    expect(viewport.hasAttribute('tabindex')).toBe(false);
  });

  it('disconnects the resize observer on destruction', () => {
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});