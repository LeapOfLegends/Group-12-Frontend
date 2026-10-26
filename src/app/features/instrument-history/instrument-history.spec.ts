import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { InstrumentHistory } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { LineChartComponent } from '../../shared/charts/line-chart/line-chart';
import {
  InstrumentHistoryPage,
  formatEquityAxisTime,
  formatEquityTooltipTime,
} from './instrument-history';

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
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;
  const isClient = signal(true);
  const params = new BehaviorSubject(convertToParamMap({ instrumentId: '7' }));

  async function setup(options: { client?: boolean; tradable?: boolean } = {}): Promise<void> {
    sessionStorage.clear();
    isClient.set(options.client ?? true);
    params.next(convertToParamMap({ instrumentId: '7' }));
    await TestBed.configureTestingModule({
      imports: [InstrumentHistoryPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        { provide: AuthService, useValue: { isClient } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(InstrumentHistoryPage);
    fixture.detectChanges();
    http.expectOne(API).flush({ ...instrument, tradable: options.tradable ?? true });
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
    sessionStorage.clear();
  });

  it('shows the stored quote and converts timestamps and decimal closes for the line chart', async () => {
    await setup();
    expect(text()).toContain('AAPL');
    expect(text()).toContain('Apple');
    expect(text()).toContain('$250.00');
    expect(text()).toContain('USD');
    load('1D', history('1D'));
    const chart = fixture.debugElement.query(By.directive(LineChartComponent))
      ?.componentInstance as LineChartComponent | undefined;
    expect(chart).not.toBeNull();
    expect(chart!.points()).toEqual([
      { time: Date.parse(points[0].timestamp), value: 249.25 },
      { time: Date.parse(points[1].timestamp), value: 250.5 },
    ]);
  });

  it('shows eligible clients a Trade button that preserves the symbol in the query string', async () => {
    await setup();
    const trade = fixture.nativeElement.querySelector(
      'a[href="/trade?symbol=AAPL"]',
    ) as HTMLAnchorElement | null;
    expect(trade?.textContent).toContain('Trade AAPL');
    trade!.click();
    expect(navigate).toHaveBeenCalled();
    expect(String(navigate.mock.calls[0][0])).toBe('/trade?symbol=AAPL');
    load('1D', history('1D'));
  });

  it('does not expose the Trade action to administrators', async () => {
    await setup({ client: false });
    expect(text()).not.toContain('Trade AAPL');
    expect(fixture.nativeElement.querySelector('a[href^="/trade"]')).toBeNull();
    load('1D', history('1D'));
  });

  it('explains and disables trading for a non-tradable instrument', async () => {
    await setup({ tradable: false });
    const disabled = fixture.nativeElement.querySelector(
      '.history-trade[disabled]',
    ) as HTMLButtonElement | null;
    expect(disabled?.disabled).toBe(true);
    expect(disabled?.textContent).toContain('Trade AAPL');
    expect(text()).toContain('This instrument is not currently tradable.');
    expect(fixture.nativeElement.querySelector('a[href^="/trade"]')).toBeNull();
    load('1D', history('1D'));
  });

  it('keeps the Trade action available when no historical candles exist', async () => {
    await setup();
    load('1D', history('1D', false, []));
    expect(text()).toContain('No historical prices');
    expect(fixture.nativeElement.querySelector('a[href="/trade?symbol=AAPL"]')).not.toBeNull();
  });

  it('switches ranges and replaces partial cached data', async () => {
    await setup();
    load('1D', history('1D'));
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
    load('1D', history('1D', false, []));
    expect(text()).toContain('No historical prices');
    select('5D');
    load('5D', history('5D', false, points.slice(0, 1)));
    expect(text()).toContain('Only one closing price');
    expect(fixture.nativeElement.querySelector('app-line-chart')).toBeNull();
  });

  it.each([503, 500])('recovers after a %i history error', async (status) => {
    await setup();
    http.expectOne(`${API}/history?range=1D`).flush({}, { status, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Retry',
    );
    retry!.click();
    load('1D', history('1D'));
    expect(fixture.nativeElement.querySelector('app-line-chart')).not.toBeNull();
  });

  it.each([
    [404, 'No price history was found'],
    [422, 'Price history is not available'],
  ])('shows a non-blocking unavailable state after a %i response', async (status, message) => {
    await setup();
    http.expectOne(`${API}/history?range=1D`).flush({}, { status, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(text()).toContain(message);
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].some(
        (item) => item.textContent?.trim() === 'Retry',
      ),
    ).toBe(false);
    if (status === 422) {
      expect(fixture.nativeElement.querySelector('button[disabled]')).not.toBeNull();
      select('5D');
      http.expectNone(`${API}/history?range=5D`);
    }
  });

  it('uses the last-trade timestamp with the large stored price', async () => {
    await setup();
    load('1D', history('1D'));
    expect(text()).toContain('AAPL');
    expect(text()).toContain('Apple');
    expect(text()).toContain('$250.00');
    expect(text()).toContain('Last trade');
    expect(text()).not.toContain('Latest stored quote');
    expect(text()).not.toContain('Historical closing prices');
  });

  it('updates the header from the shared canonical quote without reloading history', async () => {
    await setup();
    load('1D', history('1D'));
    const catalog = TestBed.inject(InstrumentCatalogService);
    const loading = catalog.load();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${environment.tradingApiUrl}/instruments`).flush([
      {
        ...instrument,
        instrumentId: 7,
        lastPrice: 255,
        lastTradeAsOf: '2026-10-22T14:05:00Z',
      },
    ]);
    await loading;
    fixture.detectChanges();
    expect(text()).toContain('$255.00');
    http.expectNone(`${API}/history?range=1D`);
  });
});

describe('US equity history time formatting', () => {
  it('shows date and actual exchange time for 5D ticks and tooltips', () => {
    const time = Date.parse('2026-10-21T14:30:00Z');
    expect(formatEquityAxisTime(time, '5D')).toMatch(/Oct 21.*10:30 AM/);
    expect(formatEquityTooltipTime(time, '5D')).toMatch(/Oct 21, 2026.*10:30 AM.*EDT/);
  });

  it('uses New York daylight-saving offsets supplied by Intl', () => {
    expect(formatEquityTooltipTime(Date.parse('2026-10-30T13:30:00Z'), '5D')).toContain('EDT');
    expect(formatEquityTooltipTime(Date.parse('2026-11-02T14:30:00Z'), '5D')).toContain('EST');
  });
});
