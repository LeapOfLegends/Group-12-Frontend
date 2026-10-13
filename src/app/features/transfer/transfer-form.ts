import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { decimalPlaces, formatMoney, parseAmount } from '../../core/utils/money';
import { IconComponent } from '../../shared/ui/icon/icon';

export type TransferMode = 'deposit' | 'withdraw';

export interface TransferRequest {
  mode: TransferMode;
  amount: number;
}

const DEPOSIT_PRESETS = [100, 500, 1000, 5000];
const MAX_TRANSFER = 1_000_000;

/** Validates an amount string: positive, at most two decimals, within the allowed limit. */
export function amountValidator(limit: () => number | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (raw === '') {
      return { required: true };
    }
    const amount = parseAmount(raw);
    if (amount === null) {
      return { invalidNumber: true };
    }
    if (amount <= 0) {
      return { notPositive: true };
    }
    if (decimalPlaces(raw.replace(/[$,\s]/g, '')) > 2) {
      return { tooManyDecimals: true };
    }
    if (amount > MAX_TRANSFER) {
      return { aboveMaximum: { max: MAX_TRANSFER } };
    }
    const available = limit();
    if (available !== null && amount > available) {
      return { insufficientFunds: { available } };
    }
    return null;
  };
}

/** Tabbed deposit / withdraw form. Emits a request for the parent to review and confirm. */
@Component({
  selector: 'app-transfer-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="segmented segmented-block transfer-tabs" role="tablist" aria-label="Transfer type">
      <button type="button" role="tab" id="tab-deposit" [attr.aria-selected]="mode() === 'deposit'" aria-controls="transfer-panel" (click)="setMode('deposit')">
        <app-icon name="arrow-down" [size]="16" />
        Deposit
      </button>
      <button type="button" role="tab" id="tab-withdraw" [attr.aria-selected]="mode() === 'withdraw'" aria-controls="transfer-panel" (click)="setMode('withdraw')">
        <app-icon name="arrow-up" [size]="16" />
        Withdraw
      </button>
    </div>

    <form id="transfer-panel" role="tabpanel" [attr.aria-labelledby]="mode() === 'deposit' ? 'tab-deposit' : 'tab-withdraw'" [formGroup]="form" (ngSubmit)="submit()" novalidate class="transfer-form">
      @if (mode() === 'withdraw') {
        <div class="available">
          <span class="available-label">Available to withdraw</span>
          <span class="available-value">{{ format(withdrawable()) }}</span>
          @if (reserved() > 0) {
            <span class="field-hint">{{ format(reserved()) }} is reserved for buy orders that are still executing and cannot be withdrawn yet.</span>
          }
        </div>
      }

      <div class="field">
        <label class="field-label" for="transfer-amount">{{ mode() === 'deposit' ? 'Deposit amount' : 'Withdrawal amount' }}</label>
        <div class="input-group">
          <span class="input-prefix" aria-hidden="true">$</span>
          <input
            id="transfer-amount"
            class="input input-money"
            formControlName="amount"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
            [attr.aria-invalid]="errorMessage() ? 'true' : null"
            [attr.aria-describedby]="errorMessage() ? 'transfer-amount-error' : 'transfer-amount-hint'"
          />
        </div>
        @if (errorMessage(); as error) {
          <p id="transfer-amount-error" class="field-error"><app-icon name="alert-circle" [size]="16" />{{ error }}</p>
        } @else {
          <p id="transfer-amount-hint" class="field-hint">Enter an amount in US dollars with up to two decimal places.</p>
        }
      </div>

      <div class="chip-row" role="group" aria-label="Quick amounts">
        @if (mode() === 'deposit') {
          @for (preset of depositPresets; track preset) {
            <button type="button" class="chip" (click)="setAmount(preset)">{{ format(preset) }}</button>
          }
        } @else {
          @for (fraction of withdrawFractions; track fraction.label) {
            <button type="button" class="chip" (click)="setAmount(roundDown(withdrawable() * fraction.value))" [disabled]="withdrawable() <= 0">
              {{ fraction.label }}
            </button>
          }
        }
      </div>

      <div class="field">
        <span class="field-label">{{ mode() === 'deposit' ? 'Funding source' : 'Destination' }}</span>
        <div class="source">
          <span class="source-icon"><app-icon name="bank" [size]="20" /></span>
          <div>
            <strong>Platform cash account</strong>
            <span class="field-hint">
              {{ mode() === 'deposit' ? 'Deposits are credited straight to your cash balance.' : 'Withdrawals are debited straight from your cash balance.' }}
              External bank links are not part of this release.
            </span>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="disabled()">
        Review {{ mode() === 'deposit' ? 'deposit' : 'withdrawal' }}
        <app-icon name="arrow-right" [size]="18" />
      </button>
    </form>
  `,
  styles: `
    .transfer-tabs {
      margin-bottom: var(--space-5);
    }

    .transfer-tabs button {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .transfer-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .available {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 14px 16px;
      border-radius: var(--radius-md);
      background: var(--color-brand-soft);
    }

    .available-label {
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-on-brand-soft);
    }

    .available-value {
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-on-brand-soft);
      font-variant-numeric: tabular-nums;
    }

    .source {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
    }

    .source div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .source-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      flex: none;
      border-radius: 10px;
      background: var(--color-surface);
      color: var(--color-brand);
      border: 1px solid var(--color-border);
    }
  `,
})
export class TransferFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly initialMode = input<TransferMode>('deposit');
  readonly withdrawable = input<number>(0);
  readonly reserved = input<number>(0);
  readonly disabled = input<boolean>(false);
  readonly submitted = output<TransferRequest>();

  protected readonly mode = signal<TransferMode>('deposit');
  protected readonly depositPresets = DEPOSIT_PRESETS;
  protected readonly withdrawFractions = [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.5 },
    { label: 'Max', value: 1 },
  ];
  protected readonly form = this.fb.nonNullable.group({
    amount: ['', [amountValidator(() => (this.mode() === 'withdraw' ? this.withdrawable() : null))]],
  });
  private readonly attempted = signal(false);
  private readonly amountValue = signal('');

  protected readonly errorMessage = computed(() => {
    this.amountValue();
    const control = this.form.controls.amount;
    if (!(control.touched || this.attempted()) || !control.errors) {
      return null;
    }
    const errors = control.errors;
    if (errors['required']) {
      return 'Enter an amount.';
    }
    if (errors['invalidNumber']) {
      return 'Enter a valid dollar amount, such as 250.00.';
    }
    if (errors['notPositive']) {
      return 'The amount must be greater than zero.';
    }
    if (errors['tooManyDecimals']) {
      return 'Use at most two decimal places.';
    }
    if (errors['aboveMaximum']) {
      return `Transfers are limited to ${formatMoney(MAX_TRANSFER)} per request.`;
    }
    if (errors['insufficientFunds']) {
      return `That is more than the ${formatMoney(this.withdrawable())} available to withdraw.`;
    }
    return 'Check the amount.';
  });

  constructor() {
    effect(() => this.mode.set(this.initialMode()));
    this.form.controls.amount.valueChanges.subscribe((value) => this.amountValue.set(value));
    // Re-validate against the latest available balance when it changes.
    effect(() => {
      this.withdrawable();
      this.mode();
      this.form.controls.amount.updateValueAndValidity();
      this.amountValue.set(this.form.controls.amount.value);
    });
  }

  protected setMode(mode: TransferMode): void {
    if (this.mode() !== mode) {
      this.mode.set(mode);
      this.attempted.set(false);
      this.form.controls.amount.markAsUntouched();
      this.form.controls.amount.updateValueAndValidity();
    }
  }

  protected setAmount(amount: number): void {
    this.form.controls.amount.setValue(amount.toFixed(2));
    this.form.controls.amount.markAsTouched();
  }

  protected roundDown(value: number): number {
    return Math.floor(value * 100) / 100;
  }

  protected format(value: number): string {
    return formatMoney(value);
  }

  protected submit(): void {
    this.attempted.set(true);
    this.form.controls.amount.markAsTouched();
    this.form.controls.amount.updateValueAndValidity();
    this.amountValue.set(this.form.controls.amount.value);
    if (this.form.invalid || this.disabled()) {
      return;
    }
    const amount = parseAmount(this.form.controls.amount.value);
    if (amount === null) {
      return;
    }
    this.submitted.emit({ mode: this.mode(), amount: Math.round(amount * 100) / 100 });
  }
}
