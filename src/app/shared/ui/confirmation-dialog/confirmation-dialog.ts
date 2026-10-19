import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon';

/**
 * Modal confirmation built on the native <dialog> element, which provides focus
 * trapping, Escape handling and an inert backdrop for free.
 */
@Component({
  selector: 'app-confirmation-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <dialog #dialog class="dialog" [attr.aria-labelledby]="titleId" (cancel)="onCancel($event)" (close)="onClosed()">
      <div class="dialog-body">
        <div class="dialog-heading">
          <span class="dialog-icon" [class.dialog-icon-danger]="tone() === 'danger'">
            <app-icon [name]="tone() === 'danger' ? 'alert-triangle' : 'info'" [size]="22" />
          </span>
          <div>
            <h2 [id]="titleId">{{ title() }}</h2>
            @if (message()) {
              <p class="text-secondary">{{ message() }}</p>
            }
          </div>
        </div>
        <ng-content />
        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary" (click)="close()" [disabled]="busy()">{{ cancelLabel() }}</button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="tone() === 'danger'"
            [class.btn-primary]="tone() !== 'danger'"
            (click)="confirm()"
            [disabled]="busy()"
            autofocus
          >
            @if (busy()) {
              <span class="spinner" aria-hidden="true"></span>
            }
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .dialog-heading {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .dialog-heading h2 {
      font-size: var(--text-xl);
      margin-bottom: 4px;
    }

    .dialog-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: var(--color-brand-soft);
      color: var(--color-brand);
    }

    .dialog-icon-danger {
      background: var(--color-negative-soft);
      color: var(--color-negative);
    }
  `,
})
export class ConfirmationDialogComponent {
  private static nextId = 0;

  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly tone = input<'primary' | 'danger'>('primary');
  readonly busy = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = `confirm-dialog-title-${ConfirmationDialogComponent.nextId++}`;
  protected readonly isOpen = signal(false);

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    const dialog = this.dialogRef().nativeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      this.isOpen.set(true);
    }
  }

  close(): void {
    const dialog = this.dialogRef().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
  }

  protected confirm(): void {
    this.confirmed.emit();
  }

  protected onCancel(event: Event): void {
    if (this.busy()) {
      event.preventDefault();
    }
  }

  protected onClosed(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.cancelled.emit();
    }
  }
}
