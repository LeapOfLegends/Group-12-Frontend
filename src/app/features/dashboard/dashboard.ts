import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatDate, greetingForHour } from '../../core/utils/dates';
import { formatMoney, formatPercent, formatSignedMoney } from '../../core/utils/money';
import { PortfolioChartComponent } from '../../shared/charts/portfolio-chart/portfolio-chart';
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

/** Client home: price search, cash, portfolio value, return, performance chart, holdings, orders and actions. */
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
  protected readonly recentMoneyTransactions = this.portfolio.recentMoneyTransactions;
  protected readonly moneyTransactionCount = this.portfolio.moneyTransactionCount;
  protected readonly transactionError = this.portfolio.transactionError;
  protected readonly allocation = this.portfolio.allocation;
  protected readonly investedSeries = this.portfolio.investedSeries;
  protected readonly pendingCount = computed(() => this.portfolio.pendingOrders().length);

  protected readonly cashValue = computed(() => formatMoney(this.portfolio.cash()));
  protected readonly holdingsValue = computed(() => formatMoney(this.summary().holdingsValue));
  protected readonly returnValue = computed(() => formatSignedMoney(this.summary().totalReturn));
  protected readonly returnDelta = computed(() => {
    const pct = this.summary().totalReturnPct;
    return pct === null ? '' : formatPercent(pct, { signed: true });
  });
  protected readonly returnTone = computed<DeltaTone>(() => {
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
  protected readonly returnHint = computed(() => {
    const summary = this.summary();
    return summary.costBasis > 0
      ? `vs. ${formatMoney(summary.costBasis)} cost basis`
      : 'No priced holdings yet';
  });
  protected readonly chartSubtitle = 'Net capital invested through filled orders';
  protected readonly chartCaption =
    'Built from your executed orders at their execution prices. Historical portfolio valuations are not yet available from the platform, so market moves between fills are not shown.';

  protected readonly formatMoneyValue = (value: number): string => formatMoney(value);

  ngOnInit(): void {
    void this.portfolio.load();
  }
}
