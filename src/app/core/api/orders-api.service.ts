import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, takeWhile, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateOrderRequest, Order, OrderStatus, OrderType } from '../models/trading.models';
import { toNumber, toNumberOrZero } from '../utils/money';
import { isSettled } from '../utils/order-reasons';

/** Group-12-Backend `/api/orders` - submission and the permanent order record. */
@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tradingApiUrl}/api/orders`;

  listForClient(clientId: number): Observable<Order[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.baseUrl}/client/${clientId}`).pipe(map((rows) => rows.map(toOrder)));
  }

  getOrder(orderId: number): Observable<Order> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/${orderId}`).pipe(map(toOrder));
  }

  /**
   * POST /api/orders. The backend validates and either ACCEPTS the order (execution
   * then happens asynchronously) or REJECTS it with a reason. Nothing is assumed
   * about execution until the order record says FILLED.
   */
  submit(request: CreateOrderRequest): Observable<Order> {
    return this.http.post<Record<string, unknown>>(this.baseUrl, request).pipe(map(toOrder));
  }

  /**
   * Re-reads an order until it reaches a final state (FILLED, REJECTED or FAILED) or
   * the polling window closes. Emits every intermediate record so the UI can show
   * progress.
   */
  pollUntilSettled(orderId: number): Observable<Order> {
    const attempts = Math.max(1, Math.ceil(environment.orderPollTimeoutMs / environment.orderPollIntervalMs));
    return timer(environment.orderPollIntervalMs, environment.orderPollIntervalMs).pipe(
      switchMap(() => this.getOrder(orderId)),
      takeWhile((order, index) => !isSettled(order.status) && index < attempts - 1, true),
    );
  }
}

export function toOrder(raw: Record<string, unknown>): Order {
  return {
    orderId: Number(raw['orderId']),
    clientId: Number(raw['clientId']),
    instrumentId: Number(raw['instrumentId']),
    orderType: String(raw['orderType']) as OrderType,
    quantity: toNumberOrZero(raw['quantity']),
    status: String(raw['status']) as OrderStatus,
    reservedCash: toNumber(raw['reservedCash']),
    submittedAt: String(raw['submittedAt'] ?? ''),
    acceptedAt: stringOrNull(raw['acceptedAt']),
    rejectedAt: stringOrNull(raw['rejectedAt']),
    failedAt: stringOrNull(raw['failedAt']),
    filledAt: stringOrNull(raw['filledAt']),
    executionPrice: toNumber(raw['executionPrice']),
    executionQuoteAsOf: stringOrNull(raw['executionQuoteAsOf']),
    tradeValue: toNumber(raw['tradeValue']),
    rejectionReason: stringOrNull(raw['rejectionReason']),
    failureReason: stringOrNull(raw['failureReason']),
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
