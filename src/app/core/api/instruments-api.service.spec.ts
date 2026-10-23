import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { InstrumentHistory } from '../models/trading.models';
import { InstrumentsApiService } from './instruments-api.service';

describe('InstrumentsApiService history', () => {
  let service: InstrumentsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InstrumentsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the selected range by instrument id and returns the backend DTO', () => {
    let result: InstrumentHistory | undefined;
    service.getHistory(12, '5D').subscribe((history) => (result = history));
    const request = http.expectOne(`${environment.tradingApiUrl}/instruments/12/history?range=5D`);
    expect(request.request.method).toBe('GET');
    const response: InstrumentHistory = {
      instrumentId: 12,
      symbol: 'AAPL',
      range: '5D',
      timeframe: '1Hour',
      currency: 'USD',
      availableFrom: '2026-10-21T14:00:00Z',
      availableTo: '2026-10-22T14:00:00Z',
      partial: true,
      points: [{ timestamp: '2026-10-21T14:00:00Z', close: 250.25 }],
    };
    request.flush(response);
    expect(result).toEqual(response);
  });
});
