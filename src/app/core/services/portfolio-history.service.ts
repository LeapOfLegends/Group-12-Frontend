import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ClientApiService } from '../api/client-api.service';
import { AuthService } from '../auth/auth.service';
import { PortfolioPerformanceHistory, PortfolioPerformanceRange } from '../models/trading.models';

export const DEFAULT_PORTFOLIO_HISTORY_RANGE: PortfolioPerformanceRange = '1D';

/**
 * Session-scoped owner of dashboard portfolio history. Range responses are cached only for the
 * current token; changing account or logging out synchronously clears every historical value.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioHistoryService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ClientApiService);
  private readonly historyState = signal<PortfolioPerformanceHistory | null>(null);
  private readonly rangeState = signal<PortfolioPerformanceRange>(DEFAULT_PORTFOLIO_HISTORY_RANGE);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly cache = new Map<PortfolioPerformanceRange, PortfolioPerformanceHistory>();
  private request?: Subscription;
  private requestKey: string | null = null;
  private activeSessionKey: string | null = null;

  readonly history = this.historyState.asReadonly();
  readonly selectedRange = this.rangeState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    effect(() => {
      const key = this.sessionKey();
      untracked(() => {
        if (key !== this.activeSessionKey) {
          this.clearForSession(key);
        }
      });
    });
  }

  load(
    range: PortfolioPerformanceRange = this.rangeState(),
    options: { force?: boolean; silent?: boolean } = {},
  ): void {
    const sessionKey = this.sessionKey();
    if (!sessionKey) {
      this.clearForSession(null);
      return;
    }
    if (sessionKey !== this.activeSessionKey) {
      this.clearForSession(sessionKey);
    }

    this.rangeState.set(range);
    const cached = this.cache.get(range);
    if (cached && !options.force) {
      this.request?.unsubscribe();
      this.request = undefined;
      this.requestKey = null;
      this.historyState.set(cached);
      this.loadingState.set(false);
      this.errorState.set(null);
      return;
    }

    const nextRequestKey = `${sessionKey}:${range}`;
    if (this.request && this.requestKey === nextRequestKey) {
      return;
    }
    this.request?.unsubscribe();
    this.requestKey = nextRequestKey;
    if (!options.silent || !this.historyState()) {
      this.historyState.set(null);
      this.loadingState.set(true);
      this.errorState.set(null);
    }

    this.request = this.api.getMyPortfolioHistory(range).subscribe({
      next: (history) => {
        if (!this.isCurrent(sessionKey, range, nextRequestKey)) return;
        this.cache.set(range, history);
        this.historyState.set(history);
        this.loadingState.set(false);
        this.errorState.set(null);
        this.finishRequest(nextRequestKey);
      },
      error: (error: unknown) => {
        if (!this.isCurrent(sessionKey, range, nextRequestKey)) return;
        this.loadingState.set(false);
        if (!options.silent || !this.historyState()) {
          this.historyState.set(null);
          this.errorState.set(portfolioHistoryError(error));
        }
        this.finishRequest(nextRequestKey);
      },
    });
  }

  retry(): void {
    this.load(this.rangeState(), { force: true });
  }

  /** Refreshes only after the dashboard has loaded history at least once. */
  refreshActive(silent = true): void {
    if (!this.historyState() && !this.cache.has(this.rangeState())) return;
    this.load(this.rangeState(), { force: true, silent });
  }

  reset(): void {
    this.clearForSession(null);
  }

  private sessionKey(): string | null {
    const user = this.auth.user();
    const token = this.auth.accessToken();
    return user?.kind === 'client' && token ? `${user.id}:${token}` : null;
  }

  private isCurrent(
    sessionKey: string,
    range: PortfolioPerformanceRange,
    requestKey: string,
  ): boolean {
    return (
      this.activeSessionKey === sessionKey &&
      this.sessionKey() === sessionKey &&
      this.rangeState() === range &&
      this.requestKey === requestKey
    );
  }

  private finishRequest(requestKey: string): void {
    if (this.requestKey !== requestKey) return;
    this.request = undefined;
    this.requestKey = null;
  }

  private clearForSession(sessionKey: string | null): void {
    this.request?.unsubscribe();
    this.request = undefined;
    this.requestKey = null;
    this.cache.clear();
    this.historyState.set(null);
    this.rangeState.set(DEFAULT_PORTFOLIO_HISTORY_RANGE);
    this.loadingState.set(false);
    this.errorState.set(null);
    this.activeSessionKey = sessionKey;
  }
}

function portfolioHistoryError(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : null;
  switch (status) {
    case 400:
      return 'That portfolio history range is not available.';
    case 401:
    case 403:
      return 'Your portfolio history is unavailable for this session. Please sign in again.';
    case 409:
      return 'Your portfolio history cannot be reconstructed for this period.';
    case 422:
      return 'Portfolio history is unavailable for one or more holdings or currencies.';
    case 503:
      return 'Historical market prices are temporarily unavailable. Please try again shortly.';
    case 0:
      return 'We could not reach the server. Check your connection and try again.';
    default:
      return 'Your portfolio history could not be loaded. Please try again.';
  }
}
