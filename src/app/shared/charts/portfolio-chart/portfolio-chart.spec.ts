import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  AccountTransaction,
  PortfolioPerformanceHistory,
} from '../../../core/models/trading.models';
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
        cumulativeReturnPercent: 0,
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
        cumulativeReturnPercent: 6.67,
        valuationStatus: 'COMPLETE',
      },
    ],
    ...overrides,
  };
}

let transactionId = 1;
function transaction(
  transactionType: string,
  amount: number,
  createdAt: string,
  orderId: number | null = null,
): AccountTransaction {
  return {
    transactionId: transactionId++,
    clientId: 12,
    orderId,
    transactionType,
    amount,
    balanceAfter: 0,
    createdAt,
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
    fixture.componentRef.setInput('history', history());
    fixture.componentRef.setInput('transactionHistoryAvailable', true);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function chart(): LineChartComponent {
    return fixture.debugElement.query(By.directive(LineChartComponent)).componentInstance;
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return (element().textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('always plots total portfolio value and removes the metric selector', () => {
    expect(
      chart()
        .points()
        .map((point) => point.value),
    ).toEqual([15000, 15500, 16000]);
    expect(chart().points()[1].breakBefore).toBe(true);
    expect(text()).toContain('$16,000.00');
    expect(element().querySelector('[aria-label="Performance metric"]')).toBeNull();
    expect(element().querySelector('[data-metric]')).toBeNull();
    expect(chart().ariaLabel()).toBe('Historical portfolio value including cash and holdings');
  });

  it('uses the latest valid backend percentage points directly beneath the value', () => {
    const summary = element().querySelector('.chart-summary')!;
    expect(summary.firstElementChild?.textContent).toContain('$16,000.00');
    expect(summary.querySelector('.return-summary')?.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      '+$1,000.00 (+6.67%)',
    );
    expect(summary.textContent).not.toContain('667.00%');
  });

  it('cash-flow adjusts period gain while ignoring buy and sell transactions', () => {
    fixture.componentRef.setInput('transactions', [
      transaction('DEPOSIT', 2000, '2026-10-02T10:00:00Z'),
      transaction('WITHDRAWAL', -500, '2026-10-03T10:00:00Z'),
      transaction('BUY', -4000, '2026-10-02T11:00:00Z', 8),
      transaction('SELL', 2500, '2026-10-03T11:00:00Z', 9),
      transaction('DEPOSIT', 700, '2026-10-01T00:00:00Z'),
      transaction('WITHDRAWAL', -200, '2026-10-04T00:00:00Z'),
      transaction('DEPOSIT', 9000, '2026-09-30T23:59:59Z'),
      transaction('WITHDRAWAL', -9000, '2026-10-05T00:00:00Z'),
    ]);
    fixture.detectChanges();

    // The start-boundary deposit is already in the opening value; the end withdrawal is included.
    // 16,000 - 15,000 - (2,000 - 500 - 200) = -300.
    expect(
      element().querySelector('.return-summary')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toContain('-$300.00 (+6.67%)');
  });

  it.each([
    { label: 'positive', totalValue: 16000, twr: 3.5, tone: 'delta-up', gain: '+$1,000.00' },
    { label: 'negative', totalValue: 14000, twr: -3.5, tone: 'delta-down', gain: '-$1,000.00' },
    { label: 'zero', totalValue: 15000, twr: 0, tone: 'delta-flat', gain: '$0.00' },
  ])('renders $label return tones', ({ totalValue, twr, tone, gain }) => {
    const next = history();
    next.points = [
      next.points[0],
      {
        ...next.points.at(-1)!,
        totalValue,
        cumulativeReturnPercent: twr,
      },
    ];
    fixture.componentRef.setInput('history', next);
    fixture.detectChanges();

    const returns = element().querySelectorAll('.return-summary .delta');
    expect(returns[0].classList).toContain(tone);
    expect(returns[1].classList).toContain(tone);
    expect(returns[0].textContent).toContain(gain);
    expect(returns[1].textContent).toContain(`${twr > 0 ? '+' : ''}${twr.toFixed(2)}%`);
  });

  it('keeps estimated-method and partial-history notices separate from the return', () => {
    fixture.componentRef.setInput(
      'history',
      history({ partial: true, unavailablePointCount: 2, returnMethod: 'ESTIMATED_TWR' }),
    );
    fixture.detectChanges();
    expect(text()).toContain('+$1,000.00 (+6.67%)');
    expect(element().querySelector('.return-summary')?.textContent).not.toContain('estimated');
    expect(text()).toContain('Some historical valuations are unavailable');
    expect(text()).toContain('2 unavailable points');
    expect(text()).toContain('Estimated using available historical closing prices');
  });

  it('does not fabricate unavailable TWR or period gain', () => {
    fixture.componentRef.setInput('history', history({ returnMethod: 'UNAVAILABLE' }));
    fixture.componentRef.setInput('transactionHistoryAvailable', false);
    fixture.detectChanges();
    expect(text()).toContain('TWR unavailable');
    expect(text()).toContain('Period gain/loss unavailable');
    expect(text()).not.toContain('+6.67% TWR');
    expect(text()).toContain('could not calculate a reliable time-weighted return');
  });

  it('does not calculate period gain without two aligned valuation boundaries', () => {
    const singlePoint = history();
    singlePoint.points = [singlePoint.points[0]];
    fixture.componentRef.setInput('history', singlePoint);
    fixture.detectChanges();
    expect(text()).toContain('Period gain/loss unavailable');
  });

  it('updates value and both returns from the newly selected range response', () => {
    fixture.componentRef.setInput('range', '5Y');
    fixture.componentRef.setInput(
      'history',
      history({
        range: '5Y',
        points: [
          { ...history().points[0], totalValue: 10000 },
          {
            ...history().points.at(-1)!,
            totalValue: 12500,
            cumulativeReturnPercent: 8.42,
          },
        ],
      }),
    );
    fixture.detectChanges();
    expect(text()).toContain('$12,500.00');
    expect(text()).toContain('+$2,500.00 (+8.42%)');
  });

  it('preserves range controls, table values, and range emissions', () => {
    const ranges: string[] = [];
    fixture.componentInstance.rangeChange.subscribe((range) => ranges.push(range));
    element().querySelector<HTMLButtonElement>('button[data-range="5Y"]')!.click();
    expect(ranges).toEqual(['5Y']);

    const tableButton = [...element().querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Show table'),
    )!;
    tableButton.click();
    fixture.detectChanges();
    expect(text()).toContain('Portfolio value');
    expect(text()).toContain('$15,500.00');
  });

  it('shows an API error state with a retry action', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.componentRef.setInput('error', 'Historical market prices are temporarily unavailable.');
    fixture.componentRef.setInput('history', null);
    fixture.detectChanges();
    expect(text()).toContain('Portfolio history unavailable');
    element().querySelector<HTMLButtonElement>('.empty-state button')!.click();
    expect(retries).toBe(1);
  });
});
