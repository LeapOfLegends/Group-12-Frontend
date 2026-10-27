import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ClientApiService } from '../api/client-api.service';
import { AuthService } from '../auth/auth.service';
import { PortfolioPerformanceHistory, PortfolioPerformanceRange } from '../models/trading.models';
import { PortfolioHistoryService } from './portfolio-history.service';

function history(range: PortfolioPerformanceRange): PortfolioPerformanceHistory {
  return {
    range,
    timeframe: '1Day',
    currency: 'USD',
    availableFrom: '2026-10-01T00:00:00Z',
    availableTo: '2026-10-02T00:00:00Z',
    partial: false,
    returnMethod: 'TWR',
    unavailablePointCount: 0,
    limitations: [],
    points: [],
  };
}

describe('PortfolioHistoryService', () => {
  const user = signal<any>({ kind: 'client', id: 12 });
  const token = signal('token-a');
  let requests: Map<PortfolioPerformanceRange, Subject<PortfolioPerformanceHistory>>;
  let getMyPortfolioHistory: ReturnType<typeof vi.fn>;
  let service: PortfolioHistoryService;

  beforeEach(() => {
    user.set({ kind: 'client', id: 12 });
    token.set('token-a');
    requests = new Map();
    getMyPortfolioHistory = vi.fn((range: PortfolioPerformanceRange) => {
      const request = new Subject<PortfolioPerformanceHistory>();
      requests.set(range, request);
      return request;
    });
    TestBed.configureTestingModule({
      providers: [
        PortfolioHistoryService,
        { provide: AuthService, useValue: { user, accessToken: () => token() } },
        { provide: ClientApiService, useValue: { getMyPortfolioHistory } },
      ],
    });
    service = TestBed.inject(PortfolioHistoryService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the default range once and caches it for the current session', () => {
    service.load();
    expect(getMyPortfolioHistory).toHaveBeenCalledWith('1M');
    requests.get('1M')!.next(history('1M'));
    expect(service.history()?.range).toBe('1M');

    service.load('1M');
    expect(getMyPortfolioHistory).toHaveBeenCalledTimes(1);
  });

  it('cancels obsolete range requests so stale data cannot replace the selection', () => {
    service.load('1D');
    const obsolete = requests.get('1D')!;
    service.load('5D');
    obsolete.next(history('1D'));
    expect(service.history()).toBeNull();

    requests.get('5D')!.next(history('5D'));
    expect(service.selectedRange()).toBe('5D');
    expect(service.history()?.range).toBe('5D');
  });

  it('clears history and cache when the authenticated account changes', () => {
    service.load('1M');
    requests.get('1M')!.next(history('1M'));
    expect(service.history()).not.toBeNull();

    user.set({ kind: 'client', id: 99 });
    token.set('token-b');
    TestBed.flushEffects();
    expect(service.history()).toBeNull();
    expect(service.selectedRange()).toBe('1M');

    service.load('1M');
    expect(getMyPortfolioHistory).toHaveBeenCalledTimes(2);
  });

  it('maps reconstruction errors and retries the selected range', () => {
    service.load('1Y');
    requests.get('1Y')!.error(new HttpErrorResponse({ status: 409, statusText: 'Conflict' }));
    expect(service.error()).toContain('cannot be reconstructed');

    service.retry();
    expect(getMyPortfolioHistory).toHaveBeenLastCalledWith('1Y');
    expect(getMyPortfolioHistory).toHaveBeenCalledTimes(2);
  });
});
