import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Instrument, MarketAvailability } from '../models/trading.models';
import { toNumber } from '../utils/money';

/** Group-12-Backend `/instruments` - symbols, names and the latest stored quotes. */
@Injectable({ providedIn: 'root' })
export class InstrumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tradingApiUrl}/instruments`;

  list(): Observable<Instrument[]> {
    return this.http.get<Record<string, unknown>[]>(this.baseUrl).pipe(map((rows) => rows.map((row) => toInstrument(row))));
  }

  getById(instrumentId: number): Observable<Instrument> {
    return this.http
      .get<Record<string, unknown>>(`${this.baseUrl}/${instrumentId}`)
      .pipe(map((row) => toInstrument(row, instrumentId)));
  }

  getMarketStatus(instrumentId: number): Observable<MarketAvailability> {
    return this.http.get<MarketAvailability>(`${this.baseUrl}/${instrumentId}/market-status`);
  }

  getBySymbol(symbol: string): Observable<Instrument> {
    return this.http
      .get<Record<string, unknown>>(`${this.baseUrl}/symbol/${encodeURIComponent(symbol.trim().toUpperCase())}`)
      .pipe(map((row) => toInstrument(row)));
  }
}

export function toInstrument(raw: Record<string, unknown>, knownId?: number): Instrument {
  const id = toNumber(raw['instrumentId']) ?? knownId;
  return {
    symbol: String(raw['symbol'] ?? ''),
    instrumentName: String(raw['instrumentName'] ?? ''),
    assetClass: String(raw['assetClass'] ?? ''),
    currency: String(raw['currency'] ?? 'USD'),
    tradable: raw['tradable'] === true,
    bidPrice: toNumber(raw['bidPrice']),
    askPrice: toNumber(raw['askPrice']),
    lastPrice: toNumber(raw['lastPrice']),
    quoteAsOf: typeof raw['quoteAsOf'] === 'string' ? raw['quoteAsOf'] : null,
    lastTradeAsOf: typeof raw['lastTradeAsOf'] === 'string' ? raw['lastTradeAsOf'] : null,
    ...(id !== undefined && id !== null ? { instrumentId: id } : {}),
  };
}
