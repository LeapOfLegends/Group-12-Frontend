import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { InstrumentCatalogService } from './instrument-catalog.service';

const BASE = `${environment.tradingApiUrl}/instruments`;

function dto(symbol: string, extra: Record<string, unknown> = {}) {
  return {
    symbol,
    instrumentName: `${symbol} Inc.`,
    assetClass: 'EQUITY',
    currency: 'USD',
    tradable: true,
    bidPrice: 10,
    askPrice: 11,
    lastPrice: 10.5,
    quoteAsOf: '2026-10-13T00:00:00Z',
    lastTradeAsOf: '2026-10-13T00:00:00Z',
    ...extra,
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('InstrumentCatalogService', () => {
  let service: InstrumentCatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InstrumentCatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('uses ids from the list endpoint directly when the DTO provides them', async () => {
    const loading = service.load();
    await tick();
    http
      .expectOne(BASE)
      .flush([dto('AAPL', { instrumentId: 2 }), dto('MSFT', { instrumentId: 3 })]);
    const instruments = await loading;
    expect(instruments.map((instrument) => instrument.instrumentId)).toEqual([2, 3]);
    expect(service.tradable().length).toBe(2);
  });

  it('resolves ids by probing /instruments/{id} in batches and stops after an empty batch', async () => {
    const loading = service.load();
    await tick();
    http.expectOne(BASE).flush([dto('AAPL'), dto('MSFT'), dto('NVDA')]);
    await tick();

    const first = http.match((request) => request.url.startsWith(`${BASE}/`));
    expect(first.length).toBe(16);
    for (const request of first) {
      const id = Number(request.request.url.split('/').pop());
      if (id === 1) {
        request.flush(dto('NVDA'));
      } else if (id === 2) {
        request.flush(dto('AAPL'));
      } else if (id === 3) {
        request.flush(dto('MSFT'));
      } else {
        request.flush(
          { status: 404, message: 'Instrument not found' },
          { status: 404, statusText: 'Not Found' },
        );
      }
    }
    await tick();

    const instruments = await loading;
    expect(
      Object.fromEntries(
        instruments.map((instrument) => [instrument.symbol, instrument.instrumentId]),
      ),
    ).toEqual({ AAPL: 2, MSFT: 3, NVDA: 1 });
    expect(JSON.parse(sessionStorage.getItem('jetzy.instrumentIds') ?? '[]')).toEqual([
      ['NVDA', 1],
      ['AAPL', 2],
      ['MSFT', 3],
    ]);
  });

  it('reuses the cached id map on later loads', async () => {
    sessionStorage.setItem('jetzy.instrumentIds', JSON.stringify([['AAPL', 2]]));
    const loading = service.load();
    await tick();
    http.expectOne(BASE).flush([dto('AAPL')]);
    const instruments = await loading;
    expect(instruments[0].instrumentId).toBe(2);
    expect(http.match((request) => request.url.startsWith(`${BASE}/`)).length).toBe(0);
  });

  it('caches instruments fetched by id', async () => {
    let first: unknown = null;
    service.getById(7).subscribe((instrument) => (first = instrument));
    http.expectOne(`${BASE}/7`).flush(dto('XOM'));
    let second: unknown = null;
    service.getById(7).subscribe((instrument) => (second = instrument));
    expect(first).toEqual(second);
    expect(first).toMatchObject({ symbol: 'XOM', instrumentId: 7 });
  });

  it('maps a 404 by id to null instead of failing', async () => {
    let result: unknown = 'unset';
    service.getById(999).subscribe((instrument) => (result = instrument));
    http.expectOne(`${BASE}/999`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();
  });

  it('refreshes slash-containing symbols by id instead of putting the symbol in the URL', async () => {
    const loading = service.load();
    await tick();
    http.expectOne(BASE).flush([
      dto('ADA/USD', {
        instrumentId: 74,
        assetClass: 'CRYPTO',
        bidPrice: 0.4,
        askPrice: 0.41,
        lastPrice: 0.405,
      }),
    ]);
    await loading;

    let refreshed: unknown = null;
    service.refreshQuote('ada/usd').subscribe((instrument) => (refreshed = instrument));
    const request = http.expectOne(`${BASE}/74`);
    expect(request.request.method).toBe('GET');
    http.expectNone(`${BASE}/symbol/ADA%2FUSD`);
    request.flush(
      dto('ADA/USD', {
        assetClass: 'CRYPTO',
        bidPrice: 0.45,
        askPrice: 0.46,
        lastPrice: 0.455,
      }),
    );

    expect(refreshed).toMatchObject({ instrumentId: 74, symbol: 'ADA/USD', lastPrice: 0.455 });
    expect(service.bySymbol().get('ADA/USD')?.lastPrice).toBe(0.455);
  });
});
