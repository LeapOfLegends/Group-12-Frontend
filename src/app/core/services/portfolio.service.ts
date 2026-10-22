import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map, switchMap } from 'rxjs';
import { ClientApiService } from '../api/client-api.service';
import { HoldingsApiService } from '../api/holdings-api.service';
import { OrdersApiService } from '../api/orders-api.service';
import { AuthService } from '../auth/auth.service';
import { Holding, Instrument, Order } from '../models/trading.models';
import { describeHttpError } from '../utils/http-error';
import {
  allocationByAssetClass,
  buildOrderRows,
  buildPositions,
  investedCapitalSeries,
  pendingSellQuantityOf,
  summarizePortfolio,
} from '../utils/portfolio-math';
import { InstrumentCatalogService } from './instrument-catalog.service';

/**
 * Facade for everything the signed-in client owns: cash, holdings and orders, plus
 * the instruments needed to label and value them. Pages read the computed signals;
 * only `load()` and `refresh()` touch the network.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly auth = inject(AuthService);
  private readonly clientApi = inject(ClientApiService);
  private readonly holdingsApi = inject(HoldingsApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalog = inject(InstrumentCatalogService);

  private readonly cashState = signal<number | null>(null);
  private readonly holdingsState = signal<Holding[]>([]);
  private readonly ordersState = signal<Order[]>([]);
  private readonly instrumentsState = signal<Map<number, Instrument>>(new Map());
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedAtState = signal<number | null>(null);
  private loadedForClientId: number | null = null;

  readonly cash = this.cashState.asReadonly();
  readonly holdings = this.holdingsState.asReadonly();
  readonly orders = this.ordersState.asReadonly();
  readonly instrumentsById = this.instrumentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loadedAt = this.loadedAtState.asReadonly();
  readonly hasLoaded = computed(() => this.loadedAtState() !== null);

  readonly positions = computed(() => buildPositions(this.holdingsState(), this.instrumentsState()));
  readonly orderRows = computed(() => buildOrderRows(this.ordersState(), this.instrumentsState()));
  readonly recentOrders = computed(() => this.orderRows().slice(0, 8));
  readonly summary = computed(() => summarizePortfolio(this.cashState() ?? 0, this.positions(), this.ordersState()));
  readonly allocation = computed(() => allocationByAssetClass(this.positions()));
  readonly investedSeries = computed(() => investedCapitalSeries(this.ordersState(), this.instrumentsState()));
  readonly pendingOrders = computed(() => this.ordersState().filter((order) => order.status === 'ACCEPTED' || order.status === 'SUBMITTED'));

  /** Loads the portfolio for the signed-in client; no-op for administrators. */
  async load(force = false): Promise<void> {
    const user = this.auth.user();
    if (!user || user.kind !== 'client') {
      this.reset();
      return;
    }
    if (!force && this.loadedForClientId === user.id && this.loadedAtState() !== null) {
      return;
    }
    if (this.loadedForClientId !== user.id) {
      this.reset();
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const clientId = user.id;
      const { balance, holdings, orders, instruments } = await firstValueFrom(
        forkJoin({
          balance: this.clientApi.getBalance(clientId),
          holdings: this.holdingsApi.listMine(),
          orders: this.ordersApi.listMine(),
        }).pipe(
          switchMap((loaded) => {
            const ids = [...loaded.holdings.map((holding) => holding.instrumentId), ...loaded.orders.map((order) => order.instrumentId)];
            return this.catalog.getMany(ids).pipe(map((instruments) => ({ ...loaded, instruments })));
          }),
        ),
      );
      this.cashState.set(balance.accountBalance);
      this.holdingsState.set(holdings);
      this.ordersState.set(orders);
      this.instrumentsState.set(instruments);
      this.loadedAtState.set(Date.now());
      this.loadedForClientId = clientId;
    } catch (error: unknown) {
      this.errorState.set(describeHttpError(error, 'Your portfolio could not be loaded.'));
    } finally {
      this.loadingState.set(false);
    }
  }

  refresh(): Promise<void> {
    return this.load(true);
  }

  /** Applies a backend-confirmed balance without a full reload (after a deposit or withdrawal). */
  applyBalance(accountBalance: number): void {
    this.cashState.set(accountBalance);
  }

  /** Quantity of an instrument that can still be sold (holding minus accepted sells). */
  sellableQuantity(instrumentId: number): number {
    const holding = this.holdingsState().find((item) => item.instrumentId === instrumentId);
    if (!holding) {
      return 0;
    }
    return Math.max(0, holding.quantity - pendingSellQuantityOf(this.ordersState(), instrumentId));
  }

  reset(): void {
    this.cashState.set(null);
    this.holdingsState.set([]);
    this.ordersState.set([]);
    this.instrumentsState.set(new Map());
    this.errorState.set(null);
    this.loadedAtState.set(null);
    this.loadedForClientId = null;
  }
}
