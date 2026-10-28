import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterEveryRender,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PortfolioPerformanceRange } from '../../core/models/trading.models';
import { PortfolioHistoryService } from '../../core/services/portfolio-history.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatDate, greetingForHour } from '../../core/utils/dates';
import { formatMoney, formatPercent, formatSignedMoney } from '../../core/utils/money';
import {
  PortfolioChartComponent,
  PortfolioChartMetric,
} from '../../shared/charts/portfolio-chart/portfolio-chart';
import { BarListComponent } from '../../shared/charts/bar-list/bar-list';
import { MoneyPipe } from '../../shared/pipes/format.pipes';
import {
  DeltaTone,
  FinancialSummaryCardComponent,
} from '../../shared/ui/financial-summary-card/financial-summary-card';
import { HoldingsTableComponent } from '../../shared/ui/holdings-table/holdings-table';
import { IconComponent } from '../../shared/ui/icon/icon';
import { InstrumentSearchComponent } from '../../shared/ui/instrument-search/instrument-search';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { OrdersTableComponent } from '../../shared/ui/orders-table/orders-table';
import { TransactionsTableComponent } from '../../shared/ui/transactions-table/transactions-table';
import {
  DEFAULT_WIDGET_ORDER,
  DashboardWidget,
  GRID_BREAKPOINTS,
  GridColumns,
  layoutStorageKey,
  loadWidgetOrder,
  orderWidgets,
  saveWidgetOrder,
  widgetWidth,
} from './dashboard-layout';
import { WidgetGrid } from './widget-grid';

/**
 * Client home: price search, cash, portfolio value and return, performance chart, holdings, orders
 * and actions. The seven widgets can be rearranged in edit mode; the order is kept per client in
 * localStorage (see dashboard-layout.ts).
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FinancialSummaryCardComponent,
    PortfolioChartComponent,
    BarListComponent,
    HoldingsTableComponent,
    OrdersTableComponent,
    IconComponent,
    InstrumentSearchComponent,
    LoadingSkeletonComponent,
    MoneyPipe,
    TransactionsTableComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly portfolio = inject(PortfolioService);
  protected readonly portfolioHistory = inject(PortfolioHistoryService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gridElement = viewChild.required<ElementRef<HTMLElement>>('widgetGrid');

  /** The widgets in the saved order, which is also the order they are rendered in. */
  protected readonly widgets: readonly DashboardWidget[];
  protected readonly editing = signal(false);
  /** Column count when the page rendered; later breakpoint changes go straight to the grid. */
  private readonly initialColumns: GridColumns;
  private readonly layoutKey = layoutStorageKey(this.auth.user()?.id);
  private grid: WidgetGrid | null = null;

  protected readonly today = formatDate(new Date());
  protected readonly greeting = computed(
    () => `${greetingForHour(new Date().getHours())}, ${this.auth.user()?.firstName || 'there'}`,
  );

  protected readonly initialLoading = computed(
    () => this.portfolio.loading() && !this.portfolio.hasLoaded(),
  );
  protected readonly summary = this.portfolio.summary;
  protected readonly positions = this.portfolio.positions;
  protected readonly recentOrders = this.portfolio.recentOrders;
  protected readonly recentTransactions = this.portfolio.recentTransactions;
  protected readonly transactionCount = this.portfolio.transactionCount;
  protected readonly transactionError = this.portfolio.transactionError;
  protected readonly allocation = this.portfolio.allocation;
  protected readonly pendingCount = computed(() => this.portfolio.pendingOrders().length);
  protected readonly chartMetric = signal<PortfolioChartMetric>('VALUE');

  protected readonly cashValue = computed(() => formatMoney(this.portfolio.cash()));
  protected readonly portfolioValue = computed(() => formatMoney(this.summary().holdingsValue));
  protected readonly returnAvailable = computed(() => {
    const summary = this.summary();
    return summary.totalReturnPct !== null && summary.unpricedHoldings === 0;
  });
  protected readonly returnValue = computed(() =>
    this.returnAvailable() ? formatSignedMoney(this.summary().totalReturn) : '',
  );
  protected readonly returnDelta = computed(() => {
    if (!this.returnAvailable()) {
      return 'Unavailable';
    }
    return formatPercent(this.summary().totalReturnPct, { signed: true });
  });
  protected readonly returnTone = computed<DeltaTone>(() => {
    if (!this.returnAvailable()) {
      return 'flat';
    }
    const value = this.summary().totalReturn;
    return value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  });
  protected readonly holdingsHint = computed(() => {
    const summary = this.summary();
    const count = this.positions().length;
    const base =
      count === 1 ? '1 holding at current prices' : `${count} holdings at current prices`;
    return summary.unpricedHoldings > 0
      ? `${base} · ${summary.unpricedHoldings} without a quote`
      : base;
  });
  protected readonly formatMoneyValue = (value: number): string => formatMoney(value);

  constructor() {
    this.widgets = orderWidgets(loadWidgetOrder(this.layoutKey) ?? DEFAULT_WIDGET_ORDER);

    // The same breakpoints as the page's media queries; smallest first, so the first match wins.
    const view = this.document.defaultView;
    const queries = GRID_BREAKPOINTS.map((breakpoint) => ({
      columns: breakpoint.columns,
      media: view?.matchMedia?.(`(max-width: ${breakpoint.maxWidth}px)`),
    }));
    const columns = (): GridColumns => queries.find((query) => query.media?.matches)?.columns ?? 12;
    const onMediaChange = () => this.grid?.setColumns(columns());
    queries.forEach((query) => query.media?.addEventListener?.('change', onMediaChange));
    this.initialColumns = columns();

    afterNextRender(() => {
      this.grid = new WidgetGrid(this.gridElement().nativeElement, this.widgets, columns());
    });
    // Widget contents change with their data (skeleton to table, more rows), so re-measure after renders.
    afterEveryRender(() => this.grid?.scheduleRefresh());
    this.destroyRef.onDestroy(() => {
      queries.forEach((query) => query.media?.removeEventListener?.('change', onMediaChange));
      this.grid?.destroy();
      this.grid = null;
    });
  }

  ngOnInit(): void {
    void this.portfolio.load();
    this.portfolioHistory.load();
  }

  protected selectHistoryRange(range: PortfolioPerformanceRange): void {
    this.portfolioHistory.load(range);
  }

  protected widgetWidth(widget: DashboardWidget): number {
    return widgetWidth(widget, this.initialColumns);
  }

  protected toggleEditing(): void {
    if (this.editing()) {
      this.finishEditing();
    } else {
      this.startEditing();
    }
  }

  protected startEditing(): void {
    this.editing.set(true);
    this.grid?.setMovable(true);
  }

  /** Locks the widgets again and keeps the arrangement for this client's next visit. */
  protected finishEditing(): void {
    this.editing.set(false);
    this.grid?.setMovable(false);
    saveWidgetOrder(this.layoutKey, this.grid?.order() ?? this.widgets.map((widget) => widget.id));
  }

  protected resetLayout(): void {
    this.grid?.applyOrder(DEFAULT_WIDGET_ORDER);
  }
}
