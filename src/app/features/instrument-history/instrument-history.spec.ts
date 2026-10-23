import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InstrumentHistory } from '../../core/models/trading.models';
import { LineChartComponent } from '../../shared/charts/line-chart/line-chart';
import { InstrumentHistoryPage } from './instrument-history';

const API = `${environment.tradingApiUrl}/instruments/7`;
const instrument = {
  symbol: 'AAPL',
  instrumentName: 'Apple',
  assetClass: 'EQUITY',
  currency: 'USD',
  tradable: true,
  bidPrice: 249,
  askPrice: 251,
  lastPrice: 250,
  quoteAsOf: '2026-10-22T14:00:00Z',
  lastTradeAsOf: '2026-10-22T14:00:00Z',
};
const points = [
  { timestamp: '2026-10-21T14:00:00Z', close: '249.25' },
  { timestamp: '2026-10-22T14:00:00Z', close: 250.5 },
];

function history(
  range: InstrumentHistory['range'],
  partial = false,
  data = points,
): InstrumentHistory {
  return {
    instrumentId: 7,
    symbol: 'AAPL',
    range,
    timeframe: '1Day',
    currency: 'USD',
    availableFrom: data[0]?.timestamp ?? null,
    availableTo: data.at(-1)?.timestamp ?? null,
    partial,
    points: data,
  };
}

describe('InstrumentHistoryPage', () => {
  let fixture: ComponentFixture<InstrumentHistoryPage>;
  let http: HttpTestingController;
  const params = new BehaviorSubject(convertToParamMap({ instrumentId: '7' }));

  async function setup(): Promise<void> {
    params.next(convertToParamMap({ instrumentId: '7' }));
    await TestBed.configureTestingModule({
      imports: [InstrumentHistoryPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InstrumentHistoryPage);
    fixture.detectChanges();
    http.expectOne(API).flush(instrument);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
  function load(range: string, response: InstrumentHistory): void {
    http.expectOne(`${API}/history?range=${range}`).flush(response);
    fixture.detectChanges();
  }
  function select(range: string): void {
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === range,
    );
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    http?.verify();
    TestBed.resetTestingModule();
  });

  it('shows the stored quote and converts timestamps and decimal closes for the line chart', async () => {
    await setup();
    expect(text()).toContain('AAPL');
    expect(text()).toContain('Apple');
    expect(text()).toContain('$250.00');
    expect(text()).toContain('USD');
    load('1M', history('1M'));
    const chart = fixture.debugElement.query(By.directive(LineChartComponent))
      ?.componentInstance as LineChartComponent | undefined;
    expect(chart).not.toBeNull();
    expect(chart!.points()).toEqual([
      { time: Date.parse(points[0].timestamp), value: 249.25 },
      { time: Date.parse(points[1].timestamp), value: 250.5 },
    ]);
  });

  it('switches ranges and replaces partial cached data', async () => {
    await setup();
    load('1M', history('1M'));
    select('5Y');
    expect(fixture.nativeElement.querySelector('app-loading-skeleton')).not.toBeNull();
    load('5Y', history('5Y', true));
    expect(text()).toContain('Only part of this range is cached');
    expect(fixture.nativeElement.querySelector('app-line-chart')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-pressed="true"]')?.textContent.trim()).toBe(
      '5Y',
    );
  });

  it('handles empty and single-point history', async () => {
    await setup();
    load('1M', history('1M', false, []));
    expect(text()).toContain('No historical prices');
    select('1D');
    load('1D', history('1D', false, points.slice(0, 1)));
    expect(text()).toContain('Only one closing price');
    expect(fixture.nativeElement.querySelector('app-line-chart')).toBeNull();
  });

  it.each([404, 422, 503, 500])('recovers after a %i history error', async (status) => {
    await setup();
    http.expectOne(`${API}/history?range=1M`).flush({}, { status, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Retry',
    );
    retry!.click();
    load('1M', history('1M'));
    expect(fixture.nativeElement.querySelector('app-line-chart')).not.toBeNull();
  });
});
