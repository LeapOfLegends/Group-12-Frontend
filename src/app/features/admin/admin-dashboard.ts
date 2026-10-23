import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminsApiService } from '../../core/api/admins-api.service';
import { ClientApiService } from '../../core/api/client-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ADMIN_ROLE_LABELS } from '../../core/models/auth.models';
import { AdminRecord, ClientRecord } from '../../core/models/trading.models';
import { InstrumentCatalogService } from '../../core/services/instrument-catalog.service';
import { ageInSeconds, formatDate } from '../../core/utils/dates';
import { describeHttpError } from '../../core/utils/http-error';
import { formatCompactMoney, formatInteger } from '../../core/utils/money';
import { FinancialSummaryCardComponent } from '../../shared/ui/financial-summary-card/financial-summary-card';
import { IconComponent } from '../../shared/ui/icon/icon';
import { InstrumentSearchComponent } from '../../shared/ui/instrument-search/instrument-search';
import { AdminManagementComponent } from './admin-management';
import { CashPositionsComponent } from './cash-positions';
import { ClientLookupComponent } from './client-lookup';
import { MarketDataHealthComponent } from './market-data-health';
import { OrderLookupComponent } from './order-lookup';
import { PlatformMetricsComponent } from './platform-metrics';

/**
 * Administrator dashboard. Every figure comes from an existing backend endpoint;
 * metrics without an endpoint are listed explicitly as unavailable, never invented.
 */
@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FinancialSummaryCardComponent,
    IconComponent,
    InstrumentSearchComponent,
    ClientLookupComponent,
    OrderLookupComponent,
    CashPositionsComponent,
    MarketDataHealthComponent,
    AdminManagementComponent,
    PlatformMetricsComponent,
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboardPage implements OnInit {
  private readonly clientApi = inject(ClientApiService);
  private readonly adminsApi = inject(AdminsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformMetrics = viewChild(PlatformMetricsComponent);
  protected readonly auth = inject(AuthService);
  protected readonly catalog = inject(InstrumentCatalogService);

  protected readonly today = formatDate(new Date());
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ADMIN_ROLE_LABELS[role] : '';
  });

  protected readonly clients = signal<ClientRecord[] | null>(null);
  protected readonly clientsError = signal<string | null>(null);
  protected readonly loadingClients = signal(false);

  protected readonly admins = signal<AdminRecord[] | null>(null);
  protected readonly adminsError = signal<string | null>(null);
  protected readonly loadingAdmins = signal(false);

  protected readonly now = signal(Date.now());

  protected readonly totalClients = computed(() => this.clients()?.length ?? null);
  protected readonly fundedAccounts = computed(() => this.clients()?.filter((client) => client.accountBalance > 0).length ?? null);
  protected readonly totalClientCash = computed(() => this.clients()?.reduce((sum, client) => sum + client.accountBalance, 0) ?? null);
  protected readonly tradableInstruments = computed(() => this.catalog.tradable().length);
  protected readonly freshQuotes = computed(() => {
    const now = this.now();
    return this.catalog.instruments().filter((instrument) => {
      const age = ageInSeconds(instrument.quoteAsOf, now);
      return age !== null && age <= environment.quoteMaxAgeSeconds;
    }).length;
  });
  protected readonly quotedInstruments = computed(() => this.catalog.instruments().filter((instrument) => instrument.quoteAsOf !== null).length);
  protected readonly totalAdmins = computed(() => this.admins()?.length ?? null);
  protected readonly adminsByRole = computed(() => {
    const admins = this.admins() ?? [];
    return {
      super_admin: admins.filter((admin) => admin.role === 'super_admin').length,
      operations: admins.filter((admin) => admin.role === 'operations').length,
      finance: admins.filter((admin) => admin.role === 'finance').length,
    };
  });

  ngOnInit(): void {
    interval(10000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
    this.loadClients();
    void this.catalog.load().catch(() => undefined);
    if (this.auth.canManageAdmins()) {
      this.loadAdmins();
    }
  }

  protected loadClients(): void {
    this.loadingClients.set(true);
    this.clientsError.set(null);
    this.clientApi.listClients().subscribe({
      next: (clients) => {
        this.clients.set(clients);
        this.loadingClients.set(false);
      },
      error: (error: unknown) => {
        this.clientsError.set(describeHttpError(error, 'Client records could not be loaded.'));
        this.loadingClients.set(false);
      },
    });
  }

  protected loadAdmins(): void {
    this.loadingAdmins.set(true);
    this.adminsError.set(null);
    this.adminsApi.list().subscribe({
      next: (admins) => {
        this.admins.set(admins);
        this.loadingAdmins.set(false);
      },
      error: (error: unknown) => {
        this.adminsError.set(describeHttpError(error, 'Administrator records could not be loaded.'));
        this.loadingAdmins.set(false);
      },
    });
  }

  protected refreshAll(): void {
    this.platformMetrics()?.reload();
    this.loadClients();
    void this.catalog.load(true).catch(() => undefined);
    if (this.auth.canManageAdmins()) {
      this.loadAdmins();
    }
  }

  protected count(value: number | null): string {
    return value === null ? '—' : formatInteger(value);
  }

  protected compactMoney(value: number | null): string {
    return value === null ? '—' : formatCompactMoney(value);
  }
}
