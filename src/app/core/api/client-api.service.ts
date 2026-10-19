import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountBalance, ClientRecord, MoneyMovementRequest } from '../models/trading.models';
import { toNumberOrZero } from '../utils/money';

/** Group-12-Backend `/api/clients` - balances, deposits, withdrawals and client records. */
@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tradingApiUrl}/api/clients`;

  getBalance(clientId: number): Observable<AccountBalance> {
    return this.http.get<AccountBalance>(`${this.baseUrl}/${clientId}/balance`).pipe(map(normalizeBalance));
  }

  /** POST /api/clients/{id}/deposit - the response carries the backend-confirmed balance. */
  deposit(clientId: number, amount: number): Observable<AccountBalance> {
    const body: MoneyMovementRequest = { amount };
    return this.http.post<AccountBalance>(`${this.baseUrl}/${clientId}/deposit`, body).pipe(map(normalizeBalance));
  }

  /** POST /api/clients/{id}/withdraw - answers 409 "Insufficient funds" when the balance is too low. */
  withdraw(clientId: number, amount: number): Observable<AccountBalance> {
    const body: MoneyMovementRequest = { amount };
    return this.http.post<AccountBalance>(`${this.baseUrl}/${clientId}/withdraw`, body).pipe(map(normalizeBalance));
  }

  getClient(clientId: number): Observable<ClientRecord> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/${clientId}`).pipe(map(toClientRecord));
  }

  getClientByEmail(email: string): Observable<ClientRecord> {
    return this.http
      .get<Record<string, unknown>>(`${this.baseUrl}/email/${encodeURIComponent(email.trim())}`)
      .pipe(map(toClientRecord));
  }

  /** GET /api/clients - every client record (administrative use only). */
  listClients(): Observable<ClientRecord[]> {
    return this.http
      .get<Record<string, unknown>[]>(this.baseUrl)
      .pipe(map((records) => records.map(toClientRecord)));
  }
}

function normalizeBalance(raw: AccountBalance): AccountBalance {
  return { clientId: Number(raw.clientId), accountBalance: toNumberOrZero(raw.accountBalance) };
}

/** Keeps only the fields the UI may use; `passwordHash` and `ssn` are dropped on purpose. */
function toClientRecord(raw: Record<string, unknown>): ClientRecord {
  return {
    clientId: Number(raw['clientId']),
    firstName: String(raw['firstName'] ?? ''),
    lastName: String(raw['lastName'] ?? ''),
    email: String(raw['email'] ?? ''),
    phoneNumber: String(raw['phoneNumber'] ?? ''),
    accountBalance: toNumberOrZero(raw['accountBalance']),
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : null,
  };
}
