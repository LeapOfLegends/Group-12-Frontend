import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Instrument, Order } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { describeHttpError, httpStatusOf } from '../../core/utils/http-error';
import { formatOrderId } from '../../core/utils/display-ids';
import { formatMoney, formatPrice } from '../../core/utils/money';
import { describeOrderOutcome, isSettled } from '../../core/utils/order-reasons';
import { DateTimePipe, MoneyPipe, PricePipe, QuantityPipe } from '../../shared/pipes/format.pipes';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';

/** Navigation state the trade page hands over right after the backend answered. */
export interface TradeReceiptState {
  order: Order;
  instrument: Instrument | null;
  /** Quote the estimate was based on when the order was placed; null when unknown. */
  estimatedPrice: number | null;
}

type ReceiptTone = 'positive' | 'pending' | 'negative';

/**
 * Confirmation of a submitted order. It shows exactly what the backend recorded,
 * follows execution of an accepted order by re-reading the order record, and never
 * calls an order executed before the record says FILLED. A refresh or deep link
 * (`?orderId=`) reloads the order from the backend.
 */
@Component({
  selector: 'app-trade-confirmation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    StatusBadgeComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    MoneyPipe,
    PricePipe,
    QuantityPipe,
    DateTimePipe,
  ],
  templateUrl: './trade-confirmation.html',
  styleUrl: './trade-confirmation.scss',
})
export class TradeConfirmationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalog = inject(InstrumentCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly portfolio = inject(PortfolioService);

  protected readonly order = signal<Order | null>(null);
  protected readonly instrument = signal<Instrument | null>(null);
  protected readonly estimatedPrice = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly polling = signal(false);
  protected readonly pollTimedOut = signal(false);
  protected readonly formatOrderId = formatOrderId;

  protected readonly status = computed(() => this.order()?.status ?? null);
  protected readonly isBuy = computed(() => this.order()?.orderType === 'BUY');

  protected readonly tone = computed<ReceiptTone>(() => {
    switch (this.status()) {
      case 'FILLED':
        return 'positive';
      case 'REJECTED':
      case 'FAILED':
        return 'negative';
      default:
        return 'pending';
    }
  });

  protected readonly heading = computed(() => {
    switch (this.status()) {
      case 'FILLED':
        return 'Trade executed';
      case 'REJECTED':
        return 'Order rejected';
      case 'FAILED':
        return 'Execution failed';
      case 'ACCEPTED':
      case 'SUBMITTED':
        return 'Order accepted';
      default:
        return 'Order';
    }
  });

  protected readonly message = computed(() => {
    const order = this.order();
    if (!order) {
      return '';
    }
    if (order.status === 'ACCEPTED' || order.status === 'SUBMITTED') {
      return `${describeOrderOutcome(order)} It has not been executed yet; this page updates as soon as the platform reports the result.`;
    }
    return describeOrderOutcome(order);
  });

  /** Estimated transaction value at submission time, when the estimate is known. */
  protected readonly estimatedTotal = computed(() => {
    const order = this.order();
    const price = this.estimatedPrice();
    return order && price !== null ? order.quantity * price : null;
  });

  protected readonly priceLabel = computed(() =>
    this.status() === 'FILLED' ? 'Execution price' : 'Price',
  );
  protected readonly totalLabel = computed(() => {
    switch (this.status()) {
      case 'FILLED':
        return 'Total transaction amount';
      case 'ACCEPTED':
      case 'SUBMITTED':
        return this.isBuy() ? 'Cash reserved (estimate)' : 'Estimated proceeds';
      default:
        return 'Total transaction amount';
    }
  });

  protected readonly placeAnotherParams = computed(() => {
    const order = this.order();
    const instrument = this.instrument();
    return {
      ...(instrument?.symbol ? { symbol: instrument.symbol } : {}),
      ...(order ? { side: order.orderType } : {}),
    };
  });

  ngOnInit(): void {
    const state = this.readState();
    const fromQuery = Number(this.route.snapshot.queryParamMap.get('orderId'));
    const orderId =
      Number.isInteger(fromQuery) && fromQuery > 0 ? fromQuery : (state?.order.orderId ?? null);
    if (orderId === null) {
      void this.router.navigate(['/trade']);
      return;
    }
    if (state && state.order.orderId === orderId) {
      this.estimatedPrice.set(state.estimatedPrice);
      this.instrument.set(state.instrument);
      this.adopt(state.order);
    } else {
      this.fetch(orderId);
    }
  }

  private readState(): TradeReceiptState | null {
    // Angular keeps `extras.state` in history.state, so the receipt also survives a refresh.
    const raw = (this.router.getCurrentNavigation()?.extras.state ??
      this.document.defaultView?.history.state) as Partial<TradeReceiptState> | null;
    const order = raw && typeof raw === 'object' ? raw.order : undefined;
    if (!order || typeof order !== 'object' || typeof order.orderId !== 'number' || !order.status) {
      return null;
    }
    return {
      order,
      instrument: raw?.instrument && typeof raw.instrument === 'object' ? raw.instrument : null,
      estimatedPrice: typeof raw?.estimatedPrice === 'number' ? raw.estimatedPrice : null,
    };
  }

  private fetch(orderId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.ordersApi.getMine(orderId).subscribe({
      next: (order) => {
        this.loading.set(false);
        this.adopt(order);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(
          httpStatusOf(error) === 404
            ? `We could not find order ${formatOrderId(orderId)}.`
            : describeHttpError(error, 'The order could not be loaded.'),
        );
      },
    });
  }

  /** Shows an order record, labels it, and follows execution while it is still open. */
  private adopt(order: Order): void {
    const user = this.auth.user();
    if (user && order.clientId !== user.id) {
      // The backend does not scope orders to the caller yet; the UI must not show another account's order.
      this.error.set('This order belongs to a different account.');
      return;
    }
    this.order.set(order);
    const known = this.instrument();
    if (!known || (known.instrumentId !== undefined && known.instrumentId !== order.instrumentId)) {
      this.catalog
        .getById(order.instrumentId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((instrument) => this.instrument.set(instrument));
    }
    if (isSettled(order.status)) {
      void this.portfolio.refresh();
    } else {
      this.follow(order.orderId);
    }
  }

  private follow(orderId: number): void {
    this.polling.set(true);
    this.pollTimedOut.set(false);
    this.ordersApi
      .pollUntilSettled(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          if (isSettled(order.status)) {
            this.polling.set(false);
            void this.portfolio.refresh();
            if (order.status === 'FILLED') {
              this.notifications.success(
                `Executed at ${formatPrice(order.executionPrice)} for ${formatMoney(order.tradeValue)}.`,
                `Order ${formatOrderId(order.orderId)} filled`,
              );
            } else {
              this.notifications.error(
                describeOrderOutcome(order),
                `Order ${formatOrderId(order.orderId)} ${order.status === 'FAILED' ? 'failed' : 'rejected'}`,
              );
            }
          }
        },
        error: (error: unknown) => {
          this.polling.set(false);
          this.notifications.warning(
            describeHttpError(
              error,
              'We lost track of the order status. Check your recent orders on the dashboard.',
            ),
          );
        },
        complete: () => {
          if (this.polling()) {
            this.polling.set(false);
            const current = this.order();
            if (current && !isSettled(current.status)) {
              this.pollTimedOut.set(true);
            }
          }
        },
      });
  }
}
