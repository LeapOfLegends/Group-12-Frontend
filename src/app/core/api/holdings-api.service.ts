import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Holding } from '../models/trading.models';
import { toNumberOrZero } from '../utils/money';

/**
 * Group-12-Backend holdings: `/api/clients/me/holdings` for the signed-in client (the id comes
 * from the JWT) and `/api/clients/{clientId}/holdings` for administrators.
 */
@Injectable({ providedIn: 'root' })
export class HoldingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tradingApiUrl}/api/clients`;

  /** GET /api/clients/me/holdings - the signed-in client's own positions. */
  listMine(): Observable<Holding[]> {
    return this.list(`${this.baseUrl}/me/holdings`);
  }

  /** GET /api/clients/{clientId}/holdings - any client's positions (super admin, operations, finance). */
  listForClient(clientId: number): Observable<Holding[]> {
    return this.list(`${this.baseUrl}/${clientId}/holdings`);
  }

  /**
   * The backend answers 404 "No holdings found for this client" for an empty
   * portfolio, which the UI treats as an empty list rather than an error.
   */
  private list(url: string): Observable<Holding[]> {
    return this.http.get<Record<string, unknown>[]>(url).pipe(
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
