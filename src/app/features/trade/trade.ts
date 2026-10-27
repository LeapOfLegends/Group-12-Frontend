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
import { BehaviorSubject, catchError, interval, of, switchMap, timeout, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InstrumentsApiService } from '../../core/api/instruments-api.service';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  CatalogInstrument,
  MarketAvailability,
  Order,
  OrderType,
} from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { ageInSeconds } from '../../core/utils/dates';
import { formatOrderId } from '../../core/utils/display-ids';
import { describeHttpError } from '../../core/utils/http-error';
import {
  decimalPlaces,
  formatMoney,
  formatQuantity,
  parseAmount,
  roundTo,
} from '../../core/utils/money';
import { describeOrderOutcome, isSettled } from '../../core/utils/order-reasons';
import { MoneyPipe, PricePipe, QuantityPipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { InstrumentHistoryChartComponent } from '../instrument-history/instrument-history-chart';
import { OrderSummaryComponent, OrderSummaryModel, TradeStep } from './order-summary';
import { TradeReceiptState } from './trade-confirmation';

const MAX_RESULTS = 12;
const MAX_QUANTITY_DECIMALS = 8;

/**
 * Place a buy or sell order against the platform's stored market quotes. Accepted orders
 * continue on /trade/confirmation; rejected orders stay here so the client can fix and retry.
 */
@Component({
  selector: 'app-trade-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    InstrumentHistoryChartComponent,
    OrderSummaryComponent,
    IconComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    MoneyPipe,
    PricePipe,
    QuantityPipe,
  ],
  templateUrl: './trade.html',
  styleUrl: './trade.scss',
})
export class TradePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly instrumentsApi = inject(InstrumentsApiService);
  private readonly marketSelection = new BehaviorSubject<number | null>(null);
  private readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly catalog = inject(InstrumentCatalogService);
  protected readonly portfolio = inject(PortfolioService);

  protected readonly quoteMaxAge = environment.quoteMaxAgeSeconds;
  protected readonly formatOrderId = formatOrderId;

  // Order entry state
  protected readonly side = signal<OrderType>('BUY');
  protected readonly query = signal('');
  protected readonly listOpen = signal(false);
  protected readonly activeIndex = signal(0);
  private readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed<CatalogInstrument | null>(() => {
    const id = this.selectedId();
    return id === null
      ? null
      : (this.catalog.instruments().find((instrument) => instrument.instrumentId === id) ?? null);
  });
  protected readonly quantityText = signal('');
  protected readonly quantityTouched = signal(false);
  protected readonly marketAvailability = signal<MarketAvailability | null>(null);
  private readonly now = signal(Date.now());

  protected readonly marketTradingAllowed = computed(() => {
    const market = this.marketAvailability();
    return (
      market?.status === 'OPEN' &&
      market.tradingAllowed === true &&
      market.validUntil !== null &&
      Date.parse(market.validUntil) > this.now()
    );
  });
  protected readonly marketMessage = computed(() => {
    const market = this.marketAvailability();
    if (!market) {
      return 'Checking market availability…';
    }
    if (market.status === 'OPEN' && !this.marketTradingAllowed()) {
      return 'Market status has expired. Trading is disabled while availability is refreshed.';
    }
    return market.message;
  });

  // Submission state
  protected readonly step = signal<TradeStep>('entry');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  /** Only rejected orders are shown here; accepted ones move to the confirmation page. */
  protected readonly result = signal<Order | null>(null);

  protected readonly loadingCatalog = computed(
    () => this.catalog.loading() && this.catalog.instruments().length === 0,
  );

  protected readonly filtered = computed<CatalogInstrument[]>(() => {
    const term = this.query().trim().toUpperCase();
    const instruments = this.catalog.instruments();
    if (!term) {
      return instruments.slice(0, MAX_RESULTS);
    }
    const starts = instruments.filter((item) => item.symbol.toUpperCase().startsWith(term));
    const contains = instruments.filter(
      (item) =>
        !starts.includes(item) &&
        (item.symbol.toUpperCase().includes(term) ||
          item.instrumentName.toUpperCase().includes(term)),
    );
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  });

  protected readonly activeOptionId = computed(() => {
    const option = this.filtered()[this.activeIndex()];
    return this.listOpen() && option ? `instrument-option-${option.instrumentId}` : null;
  });

  protected readonly quantity = computed(() => parseAmount(this.quantityText().trim()));

  protected readonly estimatedPrice = computed<number | null>(() => {
    const instrument = this.selected();
    if (!instrument) {
      return null;
    }
    const primary = this.side() === 'BUY' ? instrument.askPrice : instrument.bidPrice;
    const price = primary ?? instrument.lastPrice;
    return price !== null && price > 0 ? price : null;
  });

  protected readonly quoteAge = computed(() =>
    ageInSeconds(this.selected()?.quoteAsOf, this.now()),
  );
  protected readonly quoteStale = computed(() => {
    const age = this.quoteAge();
    return age === null || age > this.quoteMaxAge;
  });
  protected readonly estimatedValue = computed(() => {
    const quantity = this.quantity();
    const price = this.estimatedPrice();
    return quantity !== null && price !== null ? quantity * price : null;
  });

  protected readonly buyingPower = computed(() => this.portfolio.summary().buyingPower);
  protected readonly sellable = computed(() => {
    const instrument = this.selected();
    return instrument ? this.portfolio.sellableQuantity(instrument.instrumentId) : 0;
  });

  protected readonly validation = computed(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const instrument = this.selected();
    const quantity = this.quantity();
    const price = this.estimatedPrice();

    if (!instrument) {
      errors.push('Choose an instrument to trade.');
    } else {
      if (!this.marketTradingAllowed()) {
        warnings.push(this.marketMessage());
      }
      if (!instrument.tradable) {
        errors.push(`${instrument.symbol} is not currently tradable.`);
      }
      if (price === null) {
        errors.push(`No market quote is available for ${instrument.symbol} right now.`);
      } else if (this.marketTradingAllowed() && this.quoteStale()) {
        warnings.push(
          `The quote for ${instrument.symbol} is ${this.quoteAge() === null ? 'missing a timestamp' : `${this.quoteAge()}s old`}. Orders are priced against quotes under ${this.quoteMaxAge}s old, so this order may be rejected until market data refreshes.`,
        );
      }
    }

    if (this.quantityTouched() || this.quantityText().trim() !== '') {
      if (quantity === null || quantity <= 0) {
        errors.push('Enter a quantity greater than zero.');
      } else if (decimalPlaces(this.quantityText().trim()) > MAX_QUANTITY_DECIMALS) {
        errors.push(`Use at most ${MAX_QUANTITY_DECIMALS} decimal places.`);
      } else if (instrument && price !== null) {
        if (this.side() === 'BUY') {
          const value = quantity * price;
          if (value > this.buyingPower()) {
            errors.push(
              `Insufficient buying power: this order needs ${formatMoney(value)} but ${formatMoney(this.buyingPower())} is available.`,
            );
          }
        } else {
          const sellable = this.sellable();
          if (sellable <= 0) {
            errors.push(`You do not hold ${instrument.symbol}, so there is nothing to sell.`);
          } else if (quantity > sellable) {
            errors.push(`You can sell up to ${formatQuantity(sellable)} ${instrument.symbol}.`);
          }
        }
      }
    } else {
      errors.push('Enter a quantity.');
    }

    return { errors, warnings, valid: errors.length === 0 && this.marketTradingAllowed() };
  });

  protected readonly summaryModel = computed<OrderSummaryModel>(() => ({
    instrument: this.selected(),
    side: this.side(),
    quantity: this.quantity(),
    price: this.estimatedPrice(),
    value: this.estimatedValue(),
    fees: 0,
    total: this.estimatedValue(),
  }));

  protected readonly resultDescription = computed(() => {
    const order = this.result();
    return order ? describeOrderOutcome(order) : '';
  });

  protected readonly isFinal = isSettled;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const side = params.get('side');
    if (side === 'BUY' || side === 'SELL') {
      this.side.set(side);
    }
    const symbol = params.get('symbol');

    this.marketSelection
      .pipe(
        // Switching instruments cancels the old polling stream and any in-flight request.
        switchMap((id) =>
          id === null
            ? of(null)
            : timer(0, 15000).pipe(
                switchMap(() =>
                  this.instrumentsApi.getMarketStatus(id).pipe(
                    timeout(10000),
                    catchError(() =>
                      of<MarketAvailability>({
                        marketCode: null,
                        status: 'UNAVAILABLE',
                        tradingAllowed: false,
                        message:
                          'Market status could not be checked. Trading is disabled. Retrying automatically…',
                        statusAsOf: null,
                        validUntil: null,
                        rejectionReason: 'MARKET_STATUS_UNAVAILABLE',
                      }),
                    ),
                  ),
                ),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((market) => {
        this.now.set(Date.now());
        this.marketAvailability.set(market);
      });

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));

    void this.portfolio.load();
    void this.catalog
      .load()
      .then((instruments) => {
        if (symbol) {
          const match = instruments.find(
            (item) => item.symbol.toUpperCase() === symbol.toUpperCase(),
          );
          if (match) {
            this.choose(match);
          }
        }
      })
      .catch(() => undefined);
  }

  // --- instrument picker ------------------------------------------------
  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.listOpen.set(true);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const options = this.filtered();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.listOpen.set(true);
        this.activeIndex.set(Math.min(options.length - 1, this.activeIndex() + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(0, this.activeIndex() - 1));
        break;
      case 'Enter': {
        const option = options[this.activeIndex()];
        if (this.listOpen() && option) {
          event.preventDefault();
          this.choose(option);
        }
        break;
      }
      case 'Escape':
        this.listOpen.set(false);
        break;
    }
  }

  protected closeList(): void {
    this.listOpen.set(false);
  }

  protected choose(instrument: CatalogInstrument): void {
    this.selectedId.set(instrument.instrumentId);
    this.marketAvailability.set(null);
    this.marketSelection.next(instrument.instrumentId);
    this.query.set(instrument.symbol);
    this.listOpen.set(false);
    this.now.set(Date.now());
  }

  protected clearInstrument(): void {
    this.selectedId.set(null);
    this.marketSelection.next(null);
    this.query.set('');
  }

  // --- order entry ---------------------------------------------------------
  protected setSide(side: OrderType): void {
    this.side.set(side);
  }

  protected onQuantityInput(event: Event): void {
    this.quantityText.set((event.target as HTMLInputElement).value);
  }

  protected onQuantityBlur(): void {
    this.quantityTouched.set(true);
  }

  protected useMaxQuantity(): void {
    const instrument = this.selected();
    const price = this.estimatedPrice();
    if (!instrument) {
      return;
    }
    let quantity = 0;
    if (this.side() === 'BUY') {
      if (price === null || price <= 0) {
        return;
      }
      const raw = this.buyingPower() / price;
      quantity = this.allowsFractions(instrument)
        ? roundTo(Math.floor(raw * 1e8) / 1e8, 8)
        : Math.floor(raw);
    } else {
      quantity = this.sellable();
    }
    this.quantityText.set(quantity > 0 ? formatQuantityPlain(quantity) : '');
    this.quantityTouched.set(true);
  }

  protected useFraction(fraction: number): void {
    const sellable = this.sellable();
    const instrument = this.selected();
    if (!instrument || sellable <= 0) {
      return;
    }
    const raw = sellable * fraction;
    const quantity = this.allowsFractions(instrument)
      ? roundTo(Math.floor(raw * 1e8) / 1e8, 8)
      : Math.floor(raw);
    this.quantityText.set(quantity > 0 ? formatQuantityPlain(quantity) : '');
    this.quantityTouched.set(true);
  }

  protected allowsFractions(instrument: CatalogInstrument): boolean {
    const assetClass = instrument.assetClass.toUpperCase();
    return assetClass === 'CRYPTO' || assetClass === 'FOREX' || assetClass === 'FX';
  }

  protected reviewOrder(): void {
    this.quantityTouched.set(true);
    if (!this.validation().valid) {
      return;
    }
    this.submitError.set(null);
    this.step.set('review');
  }

  protected editOrder(): void {
    this.submitError.set(null);
    this.step.set('entry');
  }

  /**
   * Submits once and acts on exactly what the backend reports: a rejection is shown here
   * with its reason, anything else is handed to /trade/confirmation, which follows execution.
   */
  protected confirmOrder(): void {
    this.now.set(Date.now());
    const instrument = this.selected();
    const quantity = this.quantity();
    const user = this.auth.user();
    if (
      !instrument ||
      quantity === null ||
      !user ||
      this.submitting() ||
      !this.validation().valid
    ) {
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.ordersApi
      .submit({
        instrumentId: instrument.instrumentId,
        orderType: this.side(),
        quantity,
      })
      .subscribe({
        next: (order) => {
          this.submitting.set(false);
          void this.portfolio.refresh();
          if (order.status === 'REJECTED') {
            if (
              order.rejectionReason === 'MARKET_CLOSED' ||
              order.rejectionReason === 'MARKET_STATUS_UNAVAILABLE'
            ) {
              this.marketAvailability.set(null);
              this.marketSelection.next(instrument.instrumentId);
            }
            this.result.set(order);
            this.step.set('result');
            this.notifications.warning(
              describeOrderOutcome(order),
              `Order ${formatOrderId(order.orderId)} rejected`,
            );
            return;
          }
          const receipt: TradeReceiptState = {
            order,
            instrument,
            estimatedPrice: this.estimatedPrice(),
          };
          void this.router.navigate(['/trade/confirmation'], {
            queryParams: { orderId: order.orderId },
            state: receipt,
          });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.submitError.set(
            describeHttpError(error, 'The order could not be submitted. Nothing was placed.'),
          );
        },
      });
  }

  protected placeAnother(): void {
    this.result.set(null);
    this.submitError.set(null);
    this.quantityText.set('');
    this.quantityTouched.set(false);
    this.step.set('entry');
  }
}

function formatQuantityPlain(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(8).replace(/\.?0+$/, '');
}
