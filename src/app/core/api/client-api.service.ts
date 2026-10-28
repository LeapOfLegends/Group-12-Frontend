import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccountBalance,
  AccountTransaction,
  ClientContactUpdate,
  ClientRecord,
  MoneyMovementRequest,
  PortfolioPerformanceHistory,
  PortfolioPerformancePoint,
  PortfolioPerformanceRange,
  PortfolioReturnMethod,
  PortfolioValuationStatus,
} from '../models/trading.models';
import { toNumber, toNumberOrZero } from '../utils/money';

/** Group-12-Backend `/api/clients` - balances, deposits, withdrawals and client records. */
@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tradingApiUrl}/api/clients`;

  getBalance(_clientId: number): Observable<AccountBalance> {
    return this.http.get<AccountBalance>(`${this.baseUrl}/me/balance`).pipe(map(normalizeBalance));
  }

  /** GET /api/clients/me/transactions - the signed-in client's account ledger. */
  listMyTransactions(): Observable<AccountTransaction[]> {
    return this.http
      .get<Record<string, unknown>[]>(`${this.baseUrl}/me/transactions`)
      .pipe(map((rows) => rows.map(toAccountTransaction)));
  }

  /** Historical cash + holdings valuation and backend-calculated TWR for this session's client. */
  getMyPortfolioHistory(range: PortfolioPerformanceRange): Observable<PortfolioPerformanceHistory> {
    return this.http
      .get<Record<string, unknown>>(`${this.baseUrl}/me/portfolio/history`, {
        params: { range },
      })
      .pipe(map(toPortfolioPerformanceHistory));
  }

  /** POST /api/clients/me/balance/transactions with a deposit discriminator. */
  deposit(amount: number): Observable<AccountBalance> {
    const body: MoneyMovementRequest = { amount, type: 'DEPOSIT' };
    return this.http
      .post<AccountBalance>(`${this.baseUrl}/me/balance/transactions`, body)
      .pipe(map(normalizeBalance));
  }

  /** POST /api/clients/me/balance/transactions; answers 409 when funds are insufficient. */
  withdraw(amount: number): Observable<AccountBalance> {
    const body: MoneyMovementRequest = { amount, type: 'WITHDRAWAL' };
    return this.http
      .post<AccountBalance>(`${this.baseUrl}/me/balance/transactions`, body)
      .pipe(map(normalizeBalance));
  }

  getClient(clientId: number): Observable<ClientRecord> {
    return this.http
      .get<Record<string, unknown>>(`${this.baseUrl}/${clientId}`)
      .pipe(map(toClientRecord));
  }

  /** GET /api/clients/me - the authenticated client's own profile. */
  getMyClient(): Observable<ClientRecord> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/me`).pipe(map(toClientRecord));
  }

  /** PATCH /api/clients/me; handled by Spring Boot's updateCurrentClient endpoint. */
  updateMyContact(update: ClientContactUpdate): Observable<ClientRecord> {
    return this.http
      .patch<Record<string, unknown>>(`${this.baseUrl}/me`, update)
      .pipe(map(toClientRecord));
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

function toAccountTransaction(raw: Record<string, unknown>): AccountTransaction {
  return {
    transactionId: Number(raw['transactionId']),
    clientId: Number(raw['clientId']),
    orderId:
      raw['orderId'] === null || raw['orderId'] === undefined ? null : Number(raw['orderId']),
    transactionType: String(raw['transactionType'] ?? ''),
    amount: toNumberOrZero(raw['amount']),
    balanceAfter: toNumberOrZero(raw['balanceAfter']),
    createdAt: String(raw['createdAt'] ?? ''),
  };
}

function toPortfolioPerformanceHistory(raw: Record<string, unknown>): PortfolioPerformanceHistory {
  const rawPoints = Array.isArray(raw['points']) ? raw['points'] : [];
  return {
    range: String(raw['range'] ?? '1M') as PortfolioPerformanceRange,
    timeframe: String(raw['timeframe'] ?? ''),
    currency: String(raw['currency'] ?? 'USD'),
    availableFrom: typeof raw['availableFrom'] === 'string' ? raw['availableFrom'] : null,
    availableTo: typeof raw['availableTo'] === 'string' ? raw['availableTo'] : null,
    partial: raw['partial'] === true,
    returnMethod: String(raw['returnMethod'] ?? 'UNAVAILABLE') as PortfolioReturnMethod,
    unavailablePointCount: Math.max(0, Math.trunc(toNumberOrZero(raw['unavailablePointCount']))),
    limitations: Array.isArray(raw['limitations'])
      ? raw['limitations'].filter((item): item is string => typeof item === 'string')
      : [],
    points: rawPoints
      .map((point) =>
        point && typeof point === 'object'
          ? toPortfolioPerformancePoint(point as Record<string, unknown>)
          : null,
      )
      .filter((point): point is PortfolioPerformancePoint => point !== null),
  };
}

function toPortfolioPerformancePoint(
  raw: Record<string, unknown>,
): PortfolioPerformancePoint | null {
  const cashValue = toNumber(raw['cashValue']);
  const holdingsValue = toNumber(raw['holdingsValue']);
  const totalValue = toNumber(raw['totalValue']);
  if (cashValue === null || holdingsValue === null || totalValue === null) return null;
  return {
    timestamp: String(raw['timestamp'] ?? ''),
    cashValue,
    holdingsValue,
    totalValue,
    cumulativeReturnPercent: toNumber(raw['cumulativeReturnPercent']),
    valuationStatus: String(raw['valuationStatus'] ?? 'UNAVAILABLE') as PortfolioValuationStatus,
  };
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
