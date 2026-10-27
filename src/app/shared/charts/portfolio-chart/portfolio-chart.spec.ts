import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PortfolioPerformanceHistory } from '../../../core/models/trading.models';
import { LineChartComponent } from '../line-chart/line-chart';
import { PortfolioChartComponent } from './portfolio-chart';

function history(
  overrides: Partial<PortfolioPerformanceHistory> = {},
): PortfolioPerformanceHistory {
  return {
    range: '1M',
    timeframe: '1Day',
    currency: 'USD',
    availableFrom: '2026-10-01T00:00:00Z',
    availableTo: '2026-10-04T00:00:00Z',
    partial: false,
    returnMethod: 'TWR',
    unavailablePointCount: 0,
    limitations: [],
    points: [
      {
        timestamp: '2026-10-01T00:00:00Z',
        cashValue: 5000,
        holdingsValue: 10000,
        totalValue: 15000,
        cumulativeReturnPercent: 6.67,
        valuationStatus: 'COMPLETE',
      },
      {
        timestamp: '2026-10-02T00:00:00Z',
        cashValue: 3000,
        holdingsValue: 13000,
        totalValue: 16000,
        cumulativeReturnPercent: null,
        valuationStatus: 'UNAVAILABLE',
      },
      {
        timestamp: '2026-10-03T00:00:00Z',
        cashValue: 3000,
        holdingsValue: 12500,
        totalValue: 15500,
        cumulativeReturnPercent: -2.5,
        valuationStatus: 'CARRIED_FORWARD',
      },
      {
        timestamp: '2026-10-04T00:00:00Z',
        cashValue: 3000,
        holdingsValue: 13000,
        totalValue: 16000,
        cumulativeReturnPercent: 0,
        valuationStatus: 'COMPLETE',
      },
    ],
    ...overrides,
  };
}

describe('PortfolioChartComponent', () => {
  let fixture: ComponentFixture<PortfolioChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PortfolioChartComponent);
    fixture.componentRef.setInput('range', '1M');
    fixture.componentRef.setInput('metric', 'VALUE');
    fixture.componentRef.setInput('history', history());
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function chart(): LineChartComponent {
    return fixture.debugElement.query(By.directive(LineChartComponent)).componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('plots totalValue and labels carried-forward valuations', () => {
    expect(
      chart()
        .points()
        .map((point) => point.value),
    ).toEqual([15000, 15500, 16000]);
    expect(chart().points()[1].note).toContain('Carried forward');
    expect(chart().points()[1].breakBefore).toBe(true);
    expect(text()).toContain('$16,000.00');
  });

  it('uses backend percentage points directly and omits null TWR values', () => {
    fixture.componentRef.setInput('metric', 'TWR');
    fixture.detectChanges();
    expect(
      chart()
        .points()
        .map((point) => point.value),
    ).toEqual([6.67, -2.5, 0]);
    expect(chart().points()[1].breakBefore).toBe(true);
    const path = (fixture.nativeElement as HTMLElement).querySelector<SVGPathElement>('.line');
    expect(path?.getAttribute('d')?.match(/M/g)?.length).toBe(2);
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<SVGPathElement>('.area')
        ?.getAttribute('d'),
    ).toBe('');

    const tableButton = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Show table'),
    )!;
    tableButton.click();
    fixture.detectChanges();
    expect(text()).toContain('+6.67%');
    expect(text()).toContain('-2.50%');
    expect(text()).toContain('0.00%');
    expect(text()).not.toContain('667.00%');
  });

  it('surfaces partial, missing, and estimated history metadata', () => {
    fixture.componentRef.setInput('metric', 'TWR');
    fixture.componentRef.setInput(
      'history',
      history({ partial: true, unavailablePointCount: 2, returnMethod: 'ESTIMATED_TWR' }),
    );
    fixture.detectChanges();
    expect(text()).toContain('Some historical valuations are unavailable');
    expect(text()).toContain('2 unavailable points');
    expect(text()).toContain('Estimated using available historical closing prices');
  });

  it('emits controlled metric and range changes', () => {
    const ranges: string[] = [];
    const metrics: string[] = [];
    fixture.componentInstance.rangeChange.subscribe((range) => ranges.push(range));
    fixture.componentInstance.metricChange.subscribe((metric) => metrics.push(metric));

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[data-range="5Y"]')!
      .click();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[data-metric="TWR"]')!
      .click();
    expect(ranges).toEqual(['5Y']);
    expect(metrics).toEqual(['TWR']);
  });

  it('shows an API error state with a retry action', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.componentRef.setInput('error', 'Historical market prices are temporarily unavailable.');
    fixture.componentRef.setInput('history', null);
    fixture.detectChanges();
    expect(text()).toContain('Portfolio history unavailable');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.empty-state button')!
      .click();
    expect(retries).toBe(1);
  });
});
