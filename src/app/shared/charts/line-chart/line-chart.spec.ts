import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LineChartComponent, niceTicks } from './line-chart';

describe('niceTicks', () => {
  it('produces clean 1-2-5 steps covering the domain', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(14000, 15000, 4)).toEqual([14000, 14200, 14400, 14600, 14800, 15000]);
    expect(niceTicks(0, 8, 4)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0, 1000, 4)).toEqual([0, 200, 400, 600, 800, 1000]);
    expect(niceTicks(0, 35, 4)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(5, 5, 4)).toEqual([5]);
  });
});

describe('LineChartComponent', () => {
  let fixture: ComponentFixture<LineChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LineChartComponent] }).compileComponents();
    fixture = TestBed.createComponent(LineChartComponent);
  });

  it('renders an accessible SVG with a line, axes and an end marker for a series', async () => {
    fixture.componentRef.setInput('points', [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
      { time: 3, value: 15 },
    ]);
    fixture.componentRef.setInput('ariaLabel', 'Test series');
    await fixture.whenStable();
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Test series');
    expect(svg.getAttribute('tabindex')).toBe('0');
    expect(fixture.nativeElement.querySelector('path.line')?.getAttribute('d')).toMatch(/^M/);
    expect(fixture.nativeElement.querySelectorAll('circle.marker').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('text.axis-label').length).toBeGreaterThan(2);
  });

  it('moves the focused point with the keyboard and announces it', async () => {
    fixture.componentRef.setInput('points', [
      { time: 1, value: 10, note: 'first' },
      { time: 2, value: 20, note: 'second' },
    ]);
    fixture.componentRef.setInput('valueFormatter', (value: number) => `$${value}`);
    await fixture.whenStable();
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    svg.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tooltip')?.textContent).toContain('$20');

    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tooltip')?.textContent).toContain('$10');
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]')?.textContent).toContain('first');
  });

  it('projects fallback content when there are not enough points', async () => {
    fixture.componentRef.setInput('points', [{ time: 1, value: 10 }]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-empty')).not.toBeNull();
  });
});
