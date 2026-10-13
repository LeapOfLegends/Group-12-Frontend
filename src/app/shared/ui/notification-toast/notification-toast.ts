import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, ToastKind } from '../../../core/services/notification.service';
import { IconComponent } from '../icon/icon';

const ICONS: Record<ToastKind, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
};

/** Stacked toasts announced through a polite live region. */
@Component({
  selector: 'app-notification-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.kind" role="status">
          <app-icon [name]="icons[toast.kind]" [size]="20" />
          <div class="toast-body">
            @if (toast.title) {
              <strong>{{ toast.title }}</strong>
            }
            <span>{{ toast.message }}</span>
          </div>
          <button type="button" class="toast-close" (click)="notifications.dismiss(toast.id)" aria-label="Dismiss notification">
            <app-icon name="close" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(420px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border-radius: var(--radius-md);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-left-width: 4px;
      box-shadow: var(--shadow-lg);
      color: var(--color-text);
      pointer-events: auto;
      animation: toast-in 180ms ease-out;
    }

    .toast app-icon {
      margin-top: 1px;
    }

    .toast-success {
      border-left-color: var(--color-positive);
    }

    .toast-success app-icon {
      color: var(--color-positive);
    }

    .toast-error {
      border-left-color: var(--color-negative);
    }

    .toast-error app-icon {
      color: var(--color-negative);
    }

    .toast-warning {
      border-left-color: var(--color-warning);
    }

    .toast-warning app-icon {
      color: var(--color-warning);
    }

    .toast-info {
      border-left-color: var(--color-info);
    }

    .toast-info app-icon {
      color: var(--color-info);
    }

    .toast-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      font-size: var(--text-sm);
      line-height: 1.45;
    }

    .toast-close {
      flex: none;
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-text-secondary);
    }

    .toast-close:hover {
      background: var(--color-surface-2);
      color: var(--color-text);
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class NotificationToastComponent {
  protected readonly notifications = inject(NotificationService);
  protected readonly icons = ICONS;
}
