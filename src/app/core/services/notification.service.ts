import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  title?: string;
  /** Milliseconds before the toast auto-dismisses; 0 keeps it until closed. */
  timeoutMs: number;
}

/** In-app notifications rendered by NotificationToastComponent in an aria-live region. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly toastsState = signal<Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = this.toastsState.asReadonly();

  show(kind: ToastKind, message: string, options: { title?: string; timeoutMs?: number } = {}): number {
    const id = this.nextId++;
    const timeoutMs = options.timeoutMs ?? (kind === 'error' ? 8000 : 5000);
    const toast: Toast = { id, kind, message, title: options.title, timeoutMs };
    this.toastsState.update((toasts) => [...toasts.slice(-4), toast]);
    if (timeoutMs > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), timeoutMs),
      );
    }
    return id;
  }

  success(message: string, title?: string): number {
    return this.show('success', message, { title });
  }

  error(message: string, title?: string): number {
    return this.show('error', message, { title });
  }

  info(message: string, title?: string): number {
    return this.show('info', message, { title });
  }

  warning(message: string, title?: string): number {
    return this.show('warning', message, { title });
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toastsState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  clear(): void {
    for (const id of [...this.timers.keys()]) {
      this.dismiss(id);
    }
    this.toastsState.set([]);
  }
}
