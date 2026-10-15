import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DateTimePipe, MoneyPipe } from '../../shared/pipes/format.pipes';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { TransferReceipt, isTransferReceipt } from './transfer.models';

/**
 * Receipt for a deposit or withdrawal. The figures come from the transfer page's
 * navigation state (which the browser keeps in history, so a refresh still shows
 * them); the backend has no endpoint to read a transfer back, so without that state
 * the page explains there is nothing to show instead of inventing a transaction.
 */
@Component({
  selector: 'app-transfer-confirmation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    MoneyPipe,
    DateTimePipe,
  ],
  templateUrl: './transfer-confirmation.html',
  styleUrl: './transfer-confirmation.scss',
})
export class TransferConfirmationPage {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);

  protected readonly receipt = signal<TransferReceipt | null>(this.readReceipt());

  protected readonly isDeposit = computed(() => this.receipt()?.mode === 'deposit');
  protected readonly completed = computed(() => this.receipt()?.status === 'completed');
  protected readonly heading = computed(() => {
    const receipt = this.receipt();
    if (!receipt) {
      return '';
    }
    const kind = receipt.mode === 'deposit' ? 'Deposit' : 'Withdrawal';
    return receipt.status === 'completed' ? `${kind} completed` : `${kind} pending`;
  });
  protected readonly message = computed(() => {
    const receipt = this.receipt();
    if (!receipt) {
      return '';
    }
    if (receipt.status === 'completed') {
      return receipt.mode === 'deposit'
        ? 'The platform confirmed your deposit and credited your cash balance. The money is available for trading now.'
        : 'The platform confirmed your withdrawal and debited your cash balance.';
    }
    return 'The platform has received this transfer but has not settled it yet. Your balance will update once it is confirmed.';
  });

  private readReceipt(): TransferReceipt | null {
    // Angular keeps `extras.state` in history.state, so the receipt also survives a refresh.
    const state = (this.router.getCurrentNavigation()?.extras.state ??
      this.document.defaultView?.history.state) as { transfer?: unknown } | null;
    const candidate = state && typeof state === 'object' ? state.transfer : null;
    if (!isTransferReceipt(candidate)) {
      return null;
    }
    // Never show another account's receipt (for example after switching users in the same tab).
    const user = this.auth.user();
    return user && candidate.clientId === user.id ? candidate : null;
  }
}
