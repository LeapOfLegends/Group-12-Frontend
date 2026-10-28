import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AccountTransaction, ORDER_STATUSES, OrderStatus } from '../../core/models/trading.models';
import { PortfolioService } from '../../core/services/portfolio.service';
import { easternDateKey } from '../../core/utils/dates';
import { IconComponent } from '../../shared/ui/icon/icon';
import { OrdersTableComponent } from '../../shared/ui/orders-table/orders-table';
import { TablePagerComponent, pagedRows } from '../../shared/ui/table-pager/table-pager';
import { TransactionsTableComponent } from '../../shared/ui/transactions-table/transactions-table';

type ActivityTab = 'orders' | 'transactions';
type TransactionTypeFilter = '' | 'DEPOSIT' | 'WITHDRAWAL' | 'BUY' | 'SELL';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-activity-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, OrdersTableComponent, TablePagerComponent, TransactionsTableComponent],
  templateUrl: './activity.html',
  styleUrl: './activity.scss',
})
export class ActivityPage implements OnInit {
  protected readonly portfolio = inject(PortfolioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly orderStatuses = ORDER_STATUSES;
  protected readonly transactionTypes: readonly TransactionTypeFilter[] = [
    'DEPOSIT',
    'WITHDRAWAL',
    'BUY',
    'SELL',
  ];

  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly instrumentSearch = signal('');
  protected readonly orderStatus = signal<'' | OrderStatus>('');
  protected readonly transactionType = signal<TransactionTypeFilter>('');

  private readonly requestedTab = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tab'))),
    { initialValue: null },
  );
  protected readonly activeTab = computed<ActivityTab>(() =>
    this.requestedTab() === 'transactions' ? 'transactions' : 'orders',
  );
  protected readonly initialLoading = computed(
    () => this.portfolio.loading() && !this.portfolio.hasLoaded(),
  );
  protected readonly invalidDateRange = computed(() =>
    Boolean(this.startDate() && this.endDate() && this.startDate() > this.endDate()),
  );

  protected readonly filteredOrders = computed(() => {
    if (this.invalidDateRange()) {
      return [];
    }

    const search = this.instrumentSearch().trim().toLowerCase();
    let rows = this.portfolio.orderRows();
    if (search) {
      rows = rows.filter(
        (row) =>
          row.symbol.toLowerCase().includes(search) || row.name.toLowerCase().includes(search),
      );
    }
    rows = rows.filter((row) =>
      isWithinDateRange(row.order.submittedAt, this.startDate(), this.endDate()),
    );
    if (this.orderStatus()) {
      rows = rows.filter((row) => row.order.status === this.orderStatus());
    }

    return rows.sort((left, right) =>
      descendingByTimeAndId(
        left.order.submittedAt,
        right.order.submittedAt,
        left.order.orderId,
        right.order.orderId,
      ),
    );
  });

  protected readonly filteredTransactions = computed(() => {
    if (this.invalidDateRange()) {
      return [];
    }
    return this.portfolio
      .transactions()
      .filter((transaction) => this.transactionMatches(transaction))
      .sort((left, right) =>
        descendingByTimeAndId(
          left.createdAt,
          right.createdAt,
          left.transactionId,
          right.transactionId,
        ),
      );
  });

  protected readonly orderPaging = pagedRows(
    this.filteredOrders,
    PAGE_SIZE,
    () =>
      `${this.activeTab()}|${this.instrumentSearch()}|${this.startDate()}|${this.endDate()}|${this.orderStatus()}`,
  );
  protected readonly transactionPaging = pagedRows(
    this.filteredTransactions,
    PAGE_SIZE,
    () => `${this.activeTab()}|${this.startDate()}|${this.endDate()}|${this.transactionType()}`,
  );

  protected readonly hasDateFilters = computed(() => Boolean(this.startDate() || this.endDate()));
  protected readonly hasOrderFilters = computed(
    () =>
      Boolean(this.instrumentSearch().trim()) ||
      this.hasDateFilters() ||
      Boolean(this.orderStatus()),
  );
  protected readonly hasTransactionFilters = computed(
    () => this.hasDateFilters() || Boolean(this.transactionType()),
  );
  protected readonly orderEmptyTitle = computed(() => {
    if (this.invalidDateRange()) return 'Invalid date range';
    return this.portfolio.orderRows().length > 0 && this.hasOrderFilters()
      ? 'No orders match your filters.'
      : 'No orders yet.';
  });
  protected readonly orderEmptyMessage = computed(() =>
    this.invalidDateRange()
      ? 'Choose a start date on or before the end date.'
      : this.portfolio.orderRows().length === 0
        ? 'Orders you place will appear here with their status and outcome.'
        : this.instrumentSearch().trim()
          ? 'Try a different ticker or company name, or reset your filters.'
          : this.hasOrderFilters()
            ? 'Adjust or reset the filters to see more orders.'
            : 'Orders you place will appear here with their status and outcome.',
  );
  protected readonly transactionEmptyTitle = computed(() => {
    if (this.invalidDateRange()) return 'Invalid date range';
    return this.portfolio.transactions().length > 0 && this.hasTransactionFilters()
      ? 'No transactions match your filters.'
      : 'No transactions yet.';
  });
  protected readonly transactionEmptyMessage = computed(() =>
    this.invalidDateRange()
      ? 'Choose a start date on or before the end date.'
      : this.hasTransactionFilters()
        ? 'Adjust or reset the filters to see more transactions.'
        : 'Funding and completed trade activity will appear here.',
  );

  ngOnInit(): void {
    void this.portfolio.load();
  }

  protected selectTab(tab: ActivityTab): void {
    if (tab === this.activeTab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    let tab: ActivityTab | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      tab = this.activeTab() === 'orders' ? 'transactions' : 'orders';
    } else if (event.key === 'Home') {
      tab = 'orders';
    } else if (event.key === 'End') {
      tab = 'transactions';
    }
    if (!tab) return;
    event.preventDefault();
    this.selectTab(tab);
    queueMicrotask(() => this.document.getElementById(`${tab}-tab`)?.focus());
  }

  protected updateStartDate(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  protected updateEndDate(event: Event): void {
    this.endDate.set((event.target as HTMLInputElement).value);
  }

  protected updateInstrumentSearch(event: Event): void {
    this.instrumentSearch.set((event.target as HTMLInputElement).value);
  }

  protected clearInstrumentSearch(): void {
    this.instrumentSearch.set('');
  }

  protected updateOrderStatus(event: Event): void {
    this.orderStatus.set((event.target as HTMLSelectElement).value as '' | OrderStatus);
  }

  protected updateTransactionType(event: Event): void {
    this.transactionType.set((event.target as HTMLSelectElement).value as TransactionTypeFilter);
  }

  protected resetFilters(): void {
    this.startDate.set('');
    this.endDate.set('');
    if (this.activeTab() === 'orders') {
      this.instrumentSearch.set('');
      this.orderStatus.set('');
    } else {
      this.transactionType.set('');
    }
  }

  protected statusLabel(status: OrderStatus): string {
    return titleCase(status);
  }

  protected typeLabel(type: TransactionTypeFilter): string {
    return titleCase(type);
  }

  private transactionMatches(transaction: AccountTransaction): boolean {
    return (
      (!this.transactionType() || transaction.transactionType === this.transactionType()) &&
      isWithinDateRange(transaction.createdAt, this.startDate(), this.endDate())
    );
  }
}

function descendingByTimeAndId(
  leftTime: string,
  rightTime: string,
  leftId: number,
  rightId: number,
): number {
  const timeDifference = safeTime(rightTime) - safeTime(leftTime);
  return timeDifference || rightId - leftId;
}

function safeTime(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function isWithinDateRange(timestamp: string, startDate: string, endDate: string): boolean {
  const date = easternDateKey(timestamp);
  if (!date) return false;
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function titleCase(value: string): string {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : '';
}
