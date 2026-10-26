import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { ClientApiService } from '../api/client-api.service';
import { HoldingsApiService } from '../api/holdings-api.service';
import { OrdersApiService } from '../api/orders-api.service';
import { AuthService } from '../auth/auth.service';
import { AccountTransaction, Holding, Instrument, Order } from '../models/trading.models';
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
  private readonly transactionsState = signal<AccountTransaction[]>([]);
  private readonly transactionErrorState = signal<string | null>(null);
  private readonly instrumentsState = signal<Map<number, Instrument>>(new Map());
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedAtState = signal<number | null>(null);
  private loadedForClientId: number | null = null;
  private loadPromise: Promise<void> | null = null;
  private loadKey: string | null = null;

  readonly cash = this.cashState.asReadonly();
  readonly holdings = this.holdingsState.asReadonly();
  readonly orders = this.ordersState.asReadonly();
  readonly transactions = this.transactionsState.asReadonly();
  readonly transactionError = this.transactionErrorState.asReadonly();
  readonly instrumentsById = computed(() => {
    const merged = new Map(this.instrumentsState());
    for (const instrument of this.catalog.instruments()) {
      if (merged.has(instrument.instrumentId)) merged.set(instrument.instrumentId, instrument);
    }
    return merged;
  });
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loadedAt = this.loadedAtState.asReadonly();
  readonly hasLoaded = computed(() => this.loadedAtState() !== null);

  readonly positions = computed(() => buildPositions(this.holdingsState(), this.instrumentsById()));
  readonly orderRows = computed(() => buildOrderRows(this.ordersState(), this.instrumentsById()));
  readonly recentOrders = computed(() => this.orderRows().slice(0, 8));
  readonly recentMoneyTransactions = computed(() => this.transactionsState()
    .filter((transaction) => transaction.transactionType === 'DEPOSIT' || transaction.transactionType === 'WITHDRAWAL')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8));
  readonly moneyTransactionCount = computed(() => this.transactionsState()
    .filter((transaction) => transaction.transactionType === 'DEPOSIT' || transaction.transactionType === 'WITHDRAWAL').length);
  readonly summary = computed(() =>
    summarizePortfolio(this.cashState() ?? 0, this.positions(), this.ordersState()),
  );
  readonly allocation = computed(() => allocationByAssetClass(this.positions()));
  readonly investedSeries = computed(() =>
    investedCapitalSeries(this.ordersState(), this.instrumentsById()),
  );
  readonly pendingOrders = computed(() =>
    this.ordersState().filter(
      (order) => order.status === 'ACCEPTED' || order.status === 'SUBMITTED',
    ),
  );

  /** Loads the portfolio for the signed-in client; no-op for administrators. */
  async load(force = false, silent = false): Promise<void> {
    const user = this.auth.user();
    if (!user || user.kind !== 'client') {
      this.reset();
      return;
    }
    if (!force && this.loadedForClientId === user.id && this.loadedAtState() !== null) {
      return;
    }
    const accessToken = this.auth.accessToken();
    const requestKey = `${user.id}:${accessToken ?? ''}`;
    if (this.loadPromise && this.loadKey === requestKey) return this.loadPromise;
    if (this.loadedForClientId !== user.id) {
      this.reset();
    }
    if (!silent || !this.hasLoaded()) this.loadingState.set(true);
    if (!silent) this.errorState.set(null);
    const request = (async () => {
      try {
        const clientId = user.id;
        const { balance, holdings, orders, instruments } = await firstValueFrom(
          forkJoin({
            balance: this.clientApi.getBalance(clientId),
            holdings: this.holdingsApi.listMine(),
            orders: this.ordersApi.listMine(),
          }).pipe(
            switchMap((loaded) => {
              const ids = [
                ...loaded.holdings.map((holding) => holding.instrumentId),
                ...loaded.orders.map((order) => order.instrumentId),
              ];
              return this.catalog
                .getMany(ids)
                .pipe(map((instruments) => ({ ...loaded, instruments })));
            }),
          ),
        );
        const current = this.auth.user();
        if (
          !current ||
          current.kind !== 'client' ||
          current.id !== clientId ||
          this.auth.accessToken() !== accessToken
        )
          return;
        this.cashState.set(balance.accountBalance);
        this.holdingsState.set(holdings);
        this.ordersState.set(orders);
        this.instrumentsState.set(instruments);
        this.loadedAtState.set(Date.now());
        this.loadedForClientId = clientId;
      } catch (error: unknown) {
        if (!silent || !this.hasLoaded()) {
          this.errorState.set(describeHttpError(error, 'Your portfolio could not be loaded.'));
        }
      } finally {
        if (this.loadKey === requestKey) {
          this.loadingState.set(false);
          this.loadPromise = null;
          this.loadKey = null;
        }
      }
    })();
    this.loadPromise = request;
    this.loadKey = requestKey;
    return request;
  }

  refresh(): Promise<void> {
    return this.load(true);
  }

  refreshSilently(): Promise<void> {
    return this.load(true, true);
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
    this.transactionsState.set([]);
    this.transactionErrorState.set(null);
    this.instrumentsState.set(new Map());
    this.errorState.set(null);
    this.loadedAtState.set(null);
    this.loadedForClientId = null;
  }
}
