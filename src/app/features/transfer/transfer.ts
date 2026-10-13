import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClientApiService } from '../../core/api/client-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { describeHttpError, httpStatusOf } from '../../core/utils/http-error';
import { formatMoney } from '../../core/utils/money';
import { DateTimePipe, MoneyPipe } from '../../shared/pipes/format.pipes';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { TransferFormComponent, TransferMode, TransferRequest } from './transfer-form';

interface TransferResult {
  mode: TransferMode;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  completedAt: Date;
}

/** Deposit or withdraw cash. Money only moves when the backend confirms the new balance. */
@Component({
  selector: 'app-transfer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TransferFormComponent, IconComponent, LoadingSkeletonComponent, StatusBadgeComponent, MoneyPipe, DateTimePipe],
  templateUrl: './transfer.html',
  styleUrl: './transfer.scss',
})
export class TransferPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clientApi = inject(ClientApiService);
  private readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly portfolio = inject(PortfolioService);

  protected readonly initialMode = signal<TransferMode>('deposit');
  protected readonly step = signal<'form' | 'review' | 'result'>('form');
  protected readonly pending = signal<TransferRequest | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly result = signal<TransferResult | null>(null);

  protected readonly loading = computed(() => this.portfolio.loading() && !this.portfolio.hasLoaded());
  protected readonly cash = computed(() => this.portfolio.cash() ?? 0);
  protected readonly reserved = computed(() => this.portfolio.summary().reservedCash);
  protected readonly withdrawable = computed(() => Math.max(0, this.cash() - this.reserved()));
  protected readonly balanceAfter = computed(() => {
    const request = this.pending();
    if (!request) {
      return this.cash();
    }
    return request.mode === 'deposit' ? this.cash() + request.amount : this.cash() - request.amount;
  });

  ngOnInit(): void {
    const mode = this.route.snapshot.queryParamMap.get('mode');
    if (mode === 'withdraw' || mode === 'deposit') {
      this.initialMode.set(mode);
    }
    void this.portfolio.load();
  }

  protected review(request: TransferRequest): void {
    this.submitError.set(null);
    this.pending.set(request);
    this.step.set('review');
  }

  protected edit(): void {
    this.submitError.set(null);
    this.step.set('form');
  }

  /** Sends the transfer once; the button stays disabled until the backend answers. */
  protected confirm(): void {
    const request = this.pending();
    const user = this.auth.user();
    if (!request || !user || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    const balanceBefore = this.cash();
    const call = request.mode === 'deposit' ? this.clientApi.deposit(user.id, request.amount) : this.clientApi.withdraw(user.id, request.amount);
    call.subscribe({
      next: (balance) => {
        this.portfolio.applyBalance(balance.accountBalance);
        this.result.set({
          mode: request.mode,
          amount: request.amount,
          balanceBefore,
          balanceAfter: balance.accountBalance,
          completedAt: new Date(),
        });
        this.submitting.set(false);
        this.step.set('result');
        this.notifications.success(
          `${request.mode === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatMoney(request.amount)} completed. New balance ${formatMoney(balance.accountBalance)}.`,
        );
        void this.portfolio.refresh();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        if (httpStatusOf(error) === 409) {
          this.submitError.set('The platform reported insufficient funds for this withdrawal. Your balance may have changed; review the amount and try again.');
          void this.portfolio.refresh();
        } else {
          this.submitError.set(describeHttpError(error, 'The transfer could not be completed. No money was moved.'));
        }
      },
    });
  }

  protected startAnother(): void {
    this.result.set(null);
    this.pending.set(null);
    this.submitError.set(null);
    this.step.set('form');
  }
}
