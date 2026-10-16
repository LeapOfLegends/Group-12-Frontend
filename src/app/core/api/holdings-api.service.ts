import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Holding } from '../models/trading.models';
import { toNumberOrZero } from '../utils/money';

/** Group-12-Backend `/api/client/{clientId}/holdings`. */
@Injectable({ providedIn: 'root' })
export class HoldingsApiService {
  private readonly http = inject(HttpClient);

  /**
   * The backend answers 404 "No holdings found for this client" for an empty
   * portfolio, which the UI treats as an empty list rather than an error.
   */
  listForClient(clientId: number): Observable<Holding[]> {
    return this.http.get<Record<string, unknown>[]>(`${environment.tradingApiUrl}/api/client/${clientId}/holdings`).pipe(
      map((rows) => rows.map(toHolding)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of([] as Holding[]);
        }
        return throwError(() => error);
      }),
    );
  }
}

function toHolding(raw: Record<string, unknown>): Holding {
  return {
    holdingId: Number(raw['holdingId']),
    clientId: Number(raw['clientId']),
    instrumentId: Number(raw['instrumentId']),
    quantity: toNumberOrZero(raw['quantity']),
    averageCost: toNumberOrZero(raw['averageCost']),
    updatedAt: typeof raw['updatedAt'] === 'string' ? raw['updatedAt'] : null,
  };
}
